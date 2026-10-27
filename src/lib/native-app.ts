// Talking to the My Ward Link phone app when the site is shown inside it (in
// the browser these do nothing). The app sets window.MyWardLinkApp before the
// page loads, takes messages through ReactNativeWebView.postMessage, and
// answers with a "mwl-native" event on window.

export interface AppPushStatus {
  type: "push";
  status: "granted" | "off" | "denied" | "unavailable";
  token?: string;
  platform: string;
}

type AppWindow = Window & { MyWardLinkApp?: { platform: string; tabs?: boolean; widget?: boolean; files?: boolean }; ReactNativeWebView?: { postMessage(msg: string): void } };

export const inApp = () => typeof window !== "undefined" && !!(window as AppWindow).MyWardLinkApp;
/** Newer versions of the app draw the tab bar themselves. */
export const appHasTabs = () => typeof window !== "undefined" && !!(window as AppWindow).MyWardLinkApp?.tabs;
/** Newer versions of the app can print a page and save or share a file (the app's window can't on its own). */
export const appHandlesFiles = () => typeof window !== "undefined" && !!(window as AppWindow).MyWardLinkApp?.files;

export interface AppTab {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

export function postToApp(
  msg:
    | { type: "ready" | "enablePush" | "openSettings" | "lockStatus" }
    | { type: "open"; url: string }
    | { type: "tabs"; items: AppTab[]; active: string | null; highlight?: string | null }
    | { type: "badge"; count: number }
    | { type: "share"; url?: string; text?: string; title?: string }
    | { type: "setLock"; on: boolean }
    | { type: "widgetKey"; key: string }
    | { type: "print"; html: string }
    | { type: "saveFile"; name: string; mime: string; base64: string },
) {
  (window as AppWindow).ReactNativeWebView?.postMessage(JSON.stringify(msg));
}

export interface AppLockStatus {
  type: "lock";
  available: boolean;
  /** "Face ID", "Touch ID", "fingerprint"... */
  kind: string;
  on: boolean;
}

export function onAppLock(cb: (s: AppLockStatus) => void) {
  const listener = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d?.type === "lock") cb(d as AppLockStatus);
  };
  window.addEventListener("mwl-native", listener);
  return () => window.removeEventListener("mwl-native", listener);
}

/**
 * Shares a link: the phone's share sheet in the app (or a browser that has one),
 * else copies it. Returns "copied" when it was copied instead.
 */
export async function shareLink(s: { url: string; text?: string; title?: string }): Promise<"shared" | "copied" | "failed"> {
  if (inApp()) {
    postToApp({ type: "share", ...s });
    return "shared";
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: s.title, text: s.text, url: s.url });
      return "shared";
    } catch {
      // Cancelled, or not allowed: copy instead.
    }
  }
  try {
    await navigator.clipboard.writeText([s.text, s.url].filter(Boolean).join(" "));
    return "copied";
  } catch {
    return "failed";
  }
}

export function onAppPush(cb: (s: AppPushStatus) => void) {
  const listener = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d?.type === "push") cb(d as AppPushStatus);
  };
  window.addEventListener("mwl-native", listener);
  return () => window.removeEventListener("mwl-native", listener);
}

// The phone's token, so signing out can forget it; and "turned off in the app".
export const APP_TOKEN_COOKIE = "mwl_app_push";
const OFF_KEY = "mwl_app_push_off";

export function readCookie(name: string) {
  return document.cookie.split("; ").find((c) => c.startsWith(name + "="))?.slice(name.length + 1);
}

export async function registerAppToken(s: AppPushStatus) {
  if (s.status !== "granted" || !s.token) return false;
  const res = await fetch("/api/push/app", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: s.token, platform: s.platform }) });
  if (!res.ok) return false;
  document.cookie = `${APP_TOKEN_COOKIE}=${encodeURIComponent(s.token)}; path=/; max-age=31536000; samesite=lax`;
  return true;
}

export async function forgetAppToken() {
  const token = readCookie(APP_TOKEN_COOKIE);
  if (token) await fetch("/api/push/app", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: decodeURIComponent(token) }) });
  setAppPushOff(true);
}

export const appPushOff = () => {
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
};

export function setAppPushOff(off: boolean) {
  try {
    if (off) localStorage.setItem(OFF_KEY, "1");
    else localStorage.removeItem(OFF_KEY);
  } catch {
    // Storage unavailable: notifications just stay on.
  }
}

// The home-screen widget's key goes to the app once per page load (the app
// ignores it when nothing changed).
let widgetKeySent = false;
export async function sendWidgetKey() {
  if (widgetKeySent || !(window as AppWindow).MyWardLinkApp?.widget) return;
  widgetKeySent = true;
  const res = await fetch("/api/widget/key", { method: "POST" }).catch(() => null);
  const body = res?.ok ? ((await res.json().catch(() => null)) as { key?: string } | null) : null;
  if (body?.key) postToApp({ type: "widgetKey", key: body.key });
  else widgetKeySent = false;
}
