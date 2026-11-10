// Service worker: shows push notifications and opens the right page when tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Elders Quorum", body: event.data ? event.data.text() : "" };
  }
  // The number on the Home Screen icon (where the phone or computer shows one).
  if (typeof data.badge === "number" && self.navigator.setAppBadge) {
    (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge()).catch(() => {});
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Elders Quorum", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Stay on screen until tapped or dismissed (Android and computers; iPhones use their own setting).
      requireInteraction: true,
      // Buttons show on Android and computers; iPhones open data.url instead.
      actions: (data.actions || []).slice(0, 2).map((a) => ({ action: a.action, title: a.title })),
      data: { url: data.url || "/", actions: data.actions || [] },
      // One notification per conversation: a newer message from the same person replaces the
      // older one (still alerting), instead of a pile of separate notifications.
      ...(data.tag ? { tag: data.tag, renotify: true } : {}),
    }),
  );
});

// "I'll be teaching" confirms right from the notification, without opening the app.
async function confirmTeaching(target) {
  const u = new URL(target, self.location.origin);
  const id = Number(u.pathname.split("/")[2]);
  const res = await fetch("/api/teach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, t: u.searchParams.get("t") }) });
  if (!res.ok) throw new Error("not confirmed");
  await self.registration.showNotification("Thanks for confirming!", { body: "You're down to teach. See you Sunday.", icon: "/icon-192.png", badge: "/icon-192.png", data: { url: `/lessons/${id}` } });
}

// "Yes, I'll teach" accepts a request to teach right from the notification.
async function acceptTeachingRequest(target) {
  const u = new URL(target, self.location.origin);
  const id = Number(u.pathname.split("/")[2]);
  const res = await fetch("/api/teach-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, t: u.searchParams.get("t") }) });
  if (!res.ok) throw new Error("not accepted");
  await self.registration.showNotification("Thank you!", { body: "You're down to teach. Tap to open the lesson.", icon: "/icon-192.png", badge: "/icon-192.png", data: { url: target } });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = (event.notification.data?.actions || []).find((a) => a.action === event.action);
  if (action && action.action === "accept") {
    event.waitUntil(acceptTeachingRequest(action.url).catch(() => openPage(new URL(action.url, self.location.origin).href)));
    return;
  }
  if (action && action.action === "teach") {
    // If confirming fails (offline, expired link), open the reply page instead.
    event.waitUntil(confirmTeaching(action.url).catch(() => openPage(new URL(action.url, self.location.origin).href)));
    return;
  }
  const url = new URL(action?.url || event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(openPage(url));
});

// Brings the app forward on the right page. If the app is already open, it's
// focused and told where to go (iPhones don't support moving an open window
// from here); otherwise a new window opens on that page.
async function openPage(url) {
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const win = wins.find((w) => "focus" in w);
  if (win) {
    win.postMessage({ type: "open", url });
    try {
      await win.focus();
      return;
    } catch {
      // Couldn't bring it forward: try opening it instead.
    }
  }
  try {
    await self.clients.openWindow(url);
  } catch {
    // Not allowed outside a notification tap; nothing more to do.
  }
}

// Requests go to the network as normal (a fetch handler also keeps the app installable).
// Opening a page while the app is restarting for an update (under a minute) would show
// the host's error page: instead it says so, and opens the page by itself once it's back.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET") return;
  event.respondWith(
    fetch(req)
      .then((res) => (res.status === 502 || res.status === 503 || res.status === 504 ? updatingPage() : res))
      .catch(() => updatingPage()),
  );
});

function updatingPage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Updating… · My Ward Link</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f5f2; --text: #1f2933; --muted: #5f6b76; --accent: #1d5f99; }
  @media (prefers-color-scheme: dark) { :root { --bg: #10171f; --text: #e6ebf0; --muted: #9aa7b4; --accent: #7fb0d8; } }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); color: var(--text);
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 24px; box-sizing: border-box; }
  .spin { width: 32px; height: 32px; margin: 0 auto 16px; border: 3px solid var(--muted); border-top-color: var(--accent); border-radius: 50%; animation: s 0.9s linear infinite; }
  @keyframes s { to { transform: rotate(360deg); } }
  h1 { font-size: 20px; margin: 0 0 6px; } p { margin: 0 0 4px; color: var(--muted); } button { margin-top: 16px; font: inherit; padding: 8px 16px;
    border-radius: 10px; border: 1px solid var(--muted); background: transparent; color: var(--text); }
</style></head><body><main>
  <div class="spin" aria-hidden="true"></div>
  <h1 id="t">My Ward Link is updating</h1>
  <p id="d">It'll be back in a few seconds. This page opens by itself.</p>
  <button onclick="location.reload()">Try now</button>
</main><script>
  // Back when the app answers; offline, it says so and keeps waiting for a connection.
  const check = async () => {
    if (!navigator.onLine) {
      document.getElementById("t").textContent = "You're offline";
      document.getElementById("d").textContent = "This page opens by itself when your connection is back.";
      return;
    }
    try { const r = await fetch("/api/health", { cache: "no-store" }); if (r.ok) location.reload(); } catch (e) {}
  };
  setInterval(check, 3000);
  window.addEventListener("online", check);
</script></body></html>`;
  return new Response(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "5" } });
}
