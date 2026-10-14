import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

// The app shows the web app and adds native notifications. The web app knows
// it's inside the app from the user agent ("MyWardLinkApp") and talks to it
// with postMessage; the app answers with a "mwl-native" event on window.

const APP_URL: string = Constants.expoConfig?.extra?.appUrl ?? "https://mywardlink.net";
const APP_HOST = new URL(APP_URL).host;
const PROJECT_ID: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

SplashScreen.preventAutoHideAsync().catch(() => {});

// Show notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const COLORS = {
  light: { bg: "#f6f5f2", surface: "#ffffff", text: "#1f2933", muted: "#5f6b76", primary: "#1d3a5f", primaryText: "#ffffff" },
  dark: { bg: "#0e151d", surface: "#16202b", text: "#e6ebf0", muted: "#9aa7b4", primary: "#7fb0d8", primaryText: "#0e151d" },
};

/** Our own pages stay in the app; the rest open in the right place on the phone. */
function isOurPage(url: string) {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && u.host === APP_HOST;
  } catch {
    return url.startsWith("about:");
  }
}

/** Calendar files and subscriptions need the phone's calendar app (Safari hands them over). */
function isCalendarLink(url: string) {
  return url.startsWith("webcal:") || /\/calendar\/\d+\/ics|\/feed\/\d+\//.test(url);
}

function openOutside(url: string) {
  if (url.startsWith("https://") && !isCalendarLink(url)) WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
  else Linking.openURL(url).catch(() => {});
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

function Main() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const c = COLORS[scheme];
  const web = useRef<WebView>(null);
  const [start, setStart] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const shownOnce = useRef(false);

  // Where to open: a tapped notification, a link to the site, or the home page.
  useEffect(() => {
    (async () => {
      const fromNotification = notificationUrl(await Notifications.getLastNotificationResponseAsync());
      const link = await Linking.getInitialURL();
      setStart(fromNotification ?? (link && isOurPage(link) ? link : APP_URL));
    })();
  }, []);

  const go = useCallback((url: string) => {
    web.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
  }, []);

  // Tapping a notification, or a link to the site, while the app is running.
  useEffect(() => {
    const tap = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = notificationUrl(r);
      if (url) go(url);
    });
    const link = Linking.addEventListener("url", ({ url }) => {
      if (isOurPage(url)) go(url);
    });
    return () => {
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

  const tellWeb = useCallback((detail: object) => {
    web.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent("mwl-native", { detail: ${JSON.stringify(detail)} })); true;`);
  }, []);

  const onMessage = useCallback(
    async (e: WebViewMessageEvent) => {
      let msg: { type?: string; url?: string };
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

  const onNav = useCallback((nav: WebViewNavigation) => setCanGoBack(nav.canGoBack), []);

  const loaded = useCallback(() => {
    setLoading(false);
    if (!shownOnce.current) {
      shownOnce.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  if (!start) return null;
  return (
    // iPhone: the web app handles the notch and home bar itself. Android: keep it below the status bar.
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} edges={Platform.OS === "android" ? ["top", "bottom"] : []}>
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
        injectedJavaScriptBeforeContentLoaded={`window.MyWardLinkApp = { platform: ${JSON.stringify(Platform.OS)} }; true;`}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStart}
        onOpenWindow={(e) => openOutside(e.nativeEvent.targetUrl)}
        onNavigationStateChange={onNav}
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
});
