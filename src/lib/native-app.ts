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

type AppWindow = Window & { MyWardLinkApp?: { platform: string }; ReactNativeWebView?: { postMessage(msg: string): void } };

export const inApp = () => typeof window !== "undefined" && !!(window as AppWindow).MyWardLinkApp;

export function postToApp(msg: { type: "ready" | "enablePush" | "openSettings" } | { type: "open"; url: string }) {
  (window as AppWindow).ReactNativeWebView?.postMessage(JSON.stringify(msg));
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
