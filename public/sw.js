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
  event.waitUntil(
    self.registration.showNotification(data.title || "Elders Quorum", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Buttons show on Android and computers; iPhones open data.url instead.
      actions: (data.actions || []).slice(0, 2).map((a) => ({ action: a.action, title: a.title })),
      data: { url: data.url || "/", actions: data.actions || [] },
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
    event.waitUntil(acceptTeachingRequest(action.url).catch(() => self.clients.openWindow(new URL(action.url, self.location.origin).href)));
    return;
  }
  if (action && action.action === "teach") {
    // If confirming fails (offline, expired link), open the reply page instead.
    event.waitUntil(confirmTeaching(action.url).catch(() => self.clients.openWindow(new URL(action.url, self.location.origin).href)));
    return;
  }
  const url = new URL(action?.url || event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// A fetch handler keeps the app installable in all browsers; requests go to the network as normal.
self.addEventListener("fetch", () => {});
