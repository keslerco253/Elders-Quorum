import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, Keyboard, Linking, Platform, Pressable, Share, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { ExtensionStorage } from "@bacons/apple-targets";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { refreshAndroidWidget, saveAndroidWidgetKey } from "./android-widget";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

// The app shows the web app's pages and does the rest natively: the tab bar,
// notifications and the app icon's badge, the share sheet, and locking the app
// with Face ID. The web app knows it's inside the app from the user agent
// ("MyWardLinkApp") and talks to it with postMessage; the app answers with a
// "mwl-native" event on window.

const APP_URL: string = Constants.expoConfig?.extra?.appUrl ?? "https://mywardlink.net";
const APP_HOST = new URL(APP_URL).host;
const PROJECT_ID: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

SplashScreen.preventAutoHideAsync().catch(() => {});

// Show notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const COLORS = {
  light: { bg: "#f6f5f2", surface: "#ffffff", border: "#e3e1dc", text: "#1f2933", muted: "#5f6b76", primary: "#1d3a5f", primaryText: "#ffffff", accent: "#1d5f99", danger: "#c0392b" },
  dark: { bg: "#0e151d", surface: "#16202b", border: "#26323f", text: "#e6ebf0", muted: "#9aa7b4", primary: "#7fb0d8", primaryText: "#0e151d", accent: "#7fb0d8", danger: "#e5534b" },
};
type Colors = (typeof COLORS)["light"];

/** A tab the web app asks for (which ones depend on the organization). */
interface Tab {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

const TAB_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  home: ["home-outline", "home"],
  book: ["book-outline", "book"],
  calendar: ["calendar-outline", "calendar"],
  plan: ["document-text-outline", "document-text"],
  list: ["people-outline", "people"],
  chat: ["chatbubble-outline", "chatbubble"],
  shield: ["shield-outline", "shield"],
  more: ["ellipsis-horizontal-circle-outline", "ellipsis-horizontal-circle"],
};

// The home-screen widget. iPhone: it reads its sign-in key and the site's address
// from storage shared with the app (an App Group); see targets/widget. Android: the
// app draws it (android-widget.tsx) with the key kept in secure storage.
const widgetStorage = Platform.OS === "ios" ? new ExtensionStorage("group.com.MyWardLink.app") : null;

function refreshWidget() {
  if (widgetStorage) ExtensionStorage.reloadWidget();
  if (Platform.OS === "android") refreshAndroidWidget().catch(() => {});
}

function saveWidgetKey(key: string | null) {
  if (Platform.OS === "android") saveAndroidWidgetKey(key).catch(() => {});
  if (!widgetStorage) return;
  if ((widgetStorage.get("widgetKey") ?? null) === key && widgetStorage.get("appUrl") === APP_URL) return;
  if (key) widgetStorage.set("widgetKey", key);
  else widgetStorage.remove("widgetKey");
  widgetStorage.set("appUrl", APP_URL);
  refreshWidget();
}

// Locking the app: asked for again after it's been in the background this long.
const LOCK_KEY = "mwl_lock";
const LOCK_AFTER_MS = 60_000;

async function lockInfo() {
  const hardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
  const enrolled = hardware && (await LocalAuthentication.isEnrolledAsync().catch(() => false));
  const types = enrolled ? await LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => []) : [];
  const kind = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? Platform.OS === "ios"
      ? "Face ID"
      : "face unlock"
    : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ? Platform.OS === "ios"
        ? "Touch ID"
        : "fingerprint"
      : "your passcode";
  const on = (await SecureStore.getItemAsync(LOCK_KEY).catch(() => null)) === "1";
  return { available: enrolled, kind, on };
}

async function unlock(reason: string) {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: "Cancel" }).catch(() => ({ success: false }));
  return r.success;
}

/** Our own pages stay in the app; the rest open in the right place on the phone. */
function isOurPage(url: string) {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && u.host === APP_HOST;
  } catch {
    return url.startsWith("about:");
  }
}

/**
 * A page to open from a link: the site's own links, or the widget's
 * "mywardlink://open?path=/lessons/5" (Android).
 */
function linkTarget(url: string | null): string | null {
  if (!url) return null;
  if (isOurPage(url)) return url;
  const m = url.match(/^mywardlink:\/\/open\?path=([^&#]+)/);
  const path = m ? decodeURIComponent(m[1]) : "";
  return path.startsWith("/") && !path.startsWith("//") ? `${APP_URL}${path}` : null;
}

/** Calendar files and subscriptions need the phone's calendar app (Safari hands them over). */
function isCalendarLink(url: string) {
  return url.startsWith("webcal:") || /\/calendar\/\d+\/ics|\/feed\/\d+\//.test(url);
}

/** Video meetings open in their own app (Zoom, Meet, Teams) when it's installed. */
function isVideoMeeting(url: string) {
  try {
    return /(^|\.)(zoom\.us|zoomgov\.com|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Church website links (Gospel Library, the handbook) open in the Church's app when it's installed. */
function isChurchLink(url: string) {
  try {
    return /(^|\.)churchofjesuschrist\.org$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

const MEMBER_TOOLS_STORE = Platform.OS === "android" ? "market://details?id=org.lds.ldstools" : "https://apps.apple.com/app/id391093033";

function openOutside(url: string) {
  // Member Tools has no web pages to hand over, so it's opened by its own link; the store if it isn't installed.
  if (url.startsWith("membertools:")) {
    Linking.openURL(url).catch(() => Linking.openURL(MEMBER_TOOLS_STORE).catch(() => {}));
    return;
  }
  // An Android "open this app" link: the phone opens the app, or its store page when it isn't installed.
  if (url.startsWith("intent:")) {
    const fallback = /;S\.browser_fallback_url=([^;]+)/.exec(url)?.[1];
    Linking.openURL(url).catch(() => fallback && Linking.openURL(decodeURIComponent(fallback)).catch(() => {}));
    return;
  }
  // Handed to the phone rather than shown in a browser here, so it can open the app.
  if (isChurchLink(url) && !isCalendarLink(url)) {
    Linking.openURL(url).catch(() => WebBrowser.openBrowserAsync(url).catch(() => {}));
    return;
  }
  if (isVideoMeeting(url)) {
    Linking.openURL(url).catch(() => WebBrowser.openBrowserAsync(url).catch(() => {}));
    return;
  }
  if (url.startsWith("https://") && !isCalendarLink(url)) WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
  else Linking.openURL(url).catch(() => {});
}

/** A file from the site (a journal download): saved, then the share sheet to keep it in Files, email it, and so on. */
async function saveAndShare(name: unknown, mime: unknown, base64: string) {
  try {
    const safe = String(name || "Download").replace(/[\\/:*?"<>|]/g, "").slice(0, 100) || "Download";
    const file = new File(Paths.cache, safe);
    if (file.exists) file.delete();
    file.create();
    file.write(base64, { encoding: "base64" });
    const type = String(mime || "application/octet-stream");
    await Sharing.shareAsync(file.uri, { mimeType: type, UTI: type.includes("wordprocessingml") ? "org.openxmlformats.wordprocessingml.document" : undefined, dialogTitle: safe });
  } catch {
    // Nothing to do: the share sheet was closed or the file couldn't be written.
  }
}

/** "off": not asked yet (or dismissed on Android); "denied": turned off in the phone's settings. */
type PushResult = { status: "granted" | "off" | "denied" | "unavailable"; token?: string; platform: string };

async function getPushToken(ask: boolean): Promise<PushResult> {
  const platform = Platform.OS;
  if (!Device.isDevice || !PROJECT_ID) return { status: "unavailable", platform };
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "Notifications", importance: Notifications.AndroidImportance.HIGH });
  }
  let perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted" && ask && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (perm.status !== "granted") return { status: perm.canAskAgain ? "off" : "denied", platform };
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID })).data;
    return { status: "granted", token, platform };
  } catch {
    return { status: "unavailable", platform };
  }
}

/** The address a tapped notification points to. */
function notificationUrl(response: Notifications.NotificationResponse | null): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === "string" && isOurPage(url) ? url : null;
}

function TabBar({ tabs, active, onPress, c }: { tabs: Tab[]; active: string | null; onPress: (t: Tab) => void; c: Colors }) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.tabBar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 6) }]}>
      {tabs.map((t) => {
        const on = t.href === active;
        const [outline, filled] = TAB_ICONS[t.icon] ?? ["ellipse-outline", "ellipse"];
        return (
          <Pressable
            key={t.href}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${t.label}${t.badge ? `, ${t.badge} new` : ""}`}
            onPress={() => onPress(t)}
            style={styles.tab}
          >
            <View>
              <Ionicons name={on ? filled : outline} size={25} color={on ? c.accent : c.muted} />
              {t.badge ? (
                <View style={[styles.badge, { backgroundColor: c.danger, borderColor: c.surface }]}>
                  <Text style={styles.badgeText}>{t.badge > 99 ? "99+" : t.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, { color: on ? c.accent : c.muted }]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Pages for signing in or joining: no Back button there.
const SIGNED_OUT_PAGES = /^\/(login|welcome|join|start|review|setup|request-access|auth)(\/|$)/;

function BackBar({ onPress, c }: { onPress: () => void; c: Colors }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 6) }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Back</Text>
      </Pressable>
    </View>
  );
}

function LockScreen({ kind, onUnlock, c }: { kind: string; onUnlock: () => void; c: Colors }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.bg }]}>
      <Ionicons name="lock-closed" size={44} color={c.primary} style={{ marginBottom: 16 }} />
      <Text style={[styles.title, { color: c.text }]}>My Ward Link is locked</Text>
      <Text style={[styles.body, { color: c.muted }]}>{`Unlock with ${kind} to see your ward's messages and members.`}</Text>
      <Pressable accessibilityRole="button" onPress={onUnlock} style={[styles.button, { backgroundColor: c.primary }]}>
        <Text style={[styles.buttonText, { color: c.primaryText }]}>Unlock</Text>
      </Pressable>
    </View>
  );
}

function Main() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const c = COLORS[scheme];
  const web = useRef<WebView>(null);
  const [start, setStart] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const shownOnce = useRef(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [path, setPath] = useState("/");
  const [locked, setLocked] = useState<{ kind: string } | null>(null);
  const awayAt = useRef<number | null>(null);
  // Pages without tabs (signing in) don't send any: clear them if a new page doesn't.
  const pageLoadAt = useRef(0);
  const tabsAt = useRef(0);

  // Where to open: a tapped notification, a link to the site, or the home page.
  useEffect(() => {
    (async () => {
      const fromNotification = notificationUrl(await Notifications.getLastNotificationResponseAsync());
      const link = await Linking.getInitialURL();
      setStart(fromNotification ?? linkTarget(link) ?? APP_URL);
    })();
  }, []);

  const go = useCallback((url: string) => {
    web.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
  }, []);

  // Tapping a notification, or a link to the site, while the app is running.
  useEffect(() => {
    // Something new (a message, a reminder): the widget's count may have changed.
    const arrived = Notifications.addNotificationReceivedListener(() => refreshWidget());
    const tap = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = notificationUrl(r);
      if (url) go(url);
    });
    const link = Linking.addEventListener("url", ({ url }) => {
      const target = linkTarget(url);
      if (target) go(target);
    });
    return () => {
      arrived.remove();
      tap.remove();
      link.remove();
    };
  }, [go]);

  // Android back button goes back a page.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      web.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  // The tab bar steps aside while typing.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Face ID: asked for when the app opens, and when it comes back after a minute away.
  const askToUnlock = useCallback(async () => {
    if (await unlock("Unlock My Ward Link")) setLocked(null);
  }, []);
  useEffect(() => {
    lockInfo().then((l) => {
      if (l.on && l.available) {
        setLocked({ kind: l.kind });
        askToUnlock();
      }
    });
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "background") awayAt.current = Date.now();
      if (state === "active") refreshWidget();
      if (state === "active" && awayAt.current && Date.now() - awayAt.current > LOCK_AFTER_MS) {
        awayAt.current = null;
        const l = await lockInfo();
        if (l.on && l.available) {
          setLocked({ kind: l.kind });
          askToUnlock();
        }
      }
    });
    return () => sub.remove();
  }, [askToUnlock]);

  const tellWeb = useCallback((detail: object) => {
    web.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent("mwl-native", { detail: ${JSON.stringify(detail)} })); true;`);
  }, []);

  const onMessage = useCallback(
    async (e: WebViewMessageEvent) => {
      let msg: { type?: string; url?: string; title?: string; text?: string; items?: Tab[]; active?: string | null; count?: number; on?: boolean; key?: string; html?: string; name?: string; mime?: string; base64?: string };
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      // "ready": the page loaded; pass along the token if notifications are already allowed.
      // "enablePush": the member tapped "Turn on notifications".
      if (msg.type === "ready" || msg.type === "enablePush") tellWeb({ type: "push", ...(await getPushToken(msg.type === "enablePush")) });
      else if (msg.type === "openSettings") Linking.openSettings().catch(() => {});
      else if (msg.type === "open" && msg.url) openOutside(msg.url);
      // The tabs for this organization and page, with their counts.
      else if (msg.type === "tabs" && Array.isArray(msg.items)) {
        tabsAt.current = Date.now();
        setTabs(msg.items.slice(0, 6));
        setActiveTab(msg.active ?? null);
      }
      // The number on the app's icon: unread messages and notifications.
      else if (msg.type === "badge" && typeof msg.count === "number") Notifications.setBadgeCountAsync(Math.max(0, msg.count)).catch(() => {});
      // The phone's share sheet (a flyer, a sign-up link, an invitation).
      else if (msg.type === "share" && (msg.url || msg.text)) {
        Share.share(
          Platform.OS === "ios" && msg.url
            ? { url: msg.url, message: msg.text, title: msg.title }
            : { message: [msg.text, msg.url].filter(Boolean).join(" "), title: msg.title },
        ).catch(() => {});
      }
      // The widget's key, from each signed-in page.
      else if (msg.type === "widgetKey" && typeof msg.key === "string") saveWidgetKey(msg.key);
      // Face ID lock, from the More page.
      else if (msg.type === "print" && typeof msg.html === "string") Print.printAsync({ html: msg.html }).catch(() => {});
      else if (msg.type === "saveFile" && typeof msg.base64 === "string") saveAndShare(msg.name, msg.mime, msg.base64);
      else if (msg.type === "lockStatus") tellWeb({ type: "lock", ...(await lockInfo()) });
      else if (msg.type === "setLock") {
        const l = await lockInfo();
        if (l.available && (await unlock(msg.on ? `Use ${l.kind} to open My Ward Link` : `Turn off ${l.kind}`))) {
          await SecureStore.setItemAsync(LOCK_KEY, msg.on ? "1" : "0").catch(() => {});
        }
        tellWeb({ type: "lock", ...(await lockInfo()) });
      }
    },
    [tellWeb],
  );

  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    if (!req.isTopFrame || isOurPage(req.url)) {
      if (isOurPage(req.url) && isCalendarLink(req.url)) {
        openOutside(req.url);
        return false;
      }
      return true;
    }
    openOutside(req.url);
    return false;
  }, []);

  const onNav = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    // Signed out: the widget asks them to sign in again.
    try {
      const p = new URL(nav.url).pathname;
      setPath(p);
      if (p === "/login") saveWidgetKey(null);
    } catch {
      // Not a web address.
    }
  }, []);

  // A tab opens its page (the web app's own navigation, so it's quick); the tab
  // you're on scrolls back to the top.
  const onTab = useCallback((t: Tab) => {
    Haptics.selectionAsync().catch(() => {});
    if (t.href === activeTab) {
      web.current?.injectJavaScript("window.scrollTo({ top: 0, behavior: 'smooth' }); true;");
      return;
    }
    setActiveTab(t.href);
    web.current?.injectJavaScript(`(window.__mwlNavigate ? window.__mwlNavigate(${JSON.stringify(t.href)}) : (window.location.href = ${JSON.stringify(t.href)})); true;`);
  }, [activeTab]);

  const loaded = useCallback(() => {
    const started = pageLoadAt.current;
    setTimeout(() => {
      if (tabsAt.current < started) setTabs([]);
    }, 2000);
    setLoading(false);
    if (!shownOnce.current) {
      shownOnce.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  if (!start) return null;
  return (
    // iPhone: the web app handles the notch and home bar itself. Android: keep it below the status bar.
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} edges={Platform.OS === "android" ? (tabs.length && !keyboard ? ["top"] : ["top", "bottom"]) : []}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {failed ? (
        <View style={[styles.fill, styles.center, { backgroundColor: c.bg }]}>
          <Text style={[styles.title, { color: c.text }]}>{"Can't reach My Ward Link"}</Text>
          <Text style={[styles.body, { color: c.muted }]}>Check your internet connection and try again.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFailed(false);
              setLoading(true);
              web.current?.reload();
            }}
            style={[styles.button, { backgroundColor: c.primary }]}
          >
            <Text style={[styles.buttonText, { color: c.primaryText }]}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={web}
        source={{ uri: start }}
        style={[styles.fill, { backgroundColor: c.bg }, failed && styles.hidden]}
        applicationNameForUserAgent="MyWardLinkApp/1.0"
        injectedJavaScriptBeforeContentLoaded={`window.MyWardLinkApp = { platform: ${JSON.stringify(Platform.OS)}, tabs: true, widget: true, files: true }; if (document.documentElement) document.documentElement.classList.add("in-app"); true;`}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStart}
        // A "new window" link to our own page (a flyer, a PDF) opens in the app, which is signed in.
        onOpenWindow={(e) => {
          const url = e.nativeEvent.targetUrl;
          if (isOurPage(url) && !isCalendarLink(url)) go(url);
          else openOutside(url);
        }}
        onNavigationStateChange={onNav}
        onLoadStart={() => {
          pageLoadAt.current = Date.now();
        }}
        onLoadEnd={loaded}
        onError={() => {
          setFailed(true);
          loaded();
        }}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 500) setFailed(true);
        }}
        onContentProcessDidTerminate={() => web.current?.reload()}
        onRenderProcessGone={() => web.current?.reload()}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        allowsInlineMediaPlayback
        setSupportMultipleWindows
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        decelerationRate="normal"
      />
      {loading && !failed ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : null}
      {tabs.length > 0 && !keyboard && !failed ? <TabBar tabs={tabs} active={activeTab} onPress={onTab} c={c} /> : null}
      {/* A picture, PDF or download opened on its own has no tab bar or page to go back with: give it a Back button. */}
      {tabs.length === 0 && canGoBack && !keyboard && !failed && !SIGNED_OUT_PAGES.test(path) ? (
        <BackBar
          c={c}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            web.current?.goBack();
          }}
        />
      ) : null}
      {locked ? <LockScreen kind={locked.kind} onUnlock={askToUnlock} c={c} /> : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: "none" },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  body: { fontSize: 15, textAlign: "center", marginBottom: 20 },
  button: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  tabBar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: "center", gap: 2, minHeight: 44 },
  tabLabel: { fontSize: 10.5, fontWeight: "500" },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: 12 },
  backText: { fontSize: 17 },
  badge: { position: "absolute", top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 1.5, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 10.5, fontWeight: "700" },
});
