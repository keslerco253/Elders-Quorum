import { afterEach, describe, expect, it, vi } from "vitest";

describe("notifications to the phone app", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends through Expo with the full link, and forgets phones that removed the app", async () => {
    process.env.APP_URL = "https://mywardlink.net";
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name) VALUES (1, 'W');
      INSERT INTO members (id, ward_id, name, display_name, email) VALUES (1, 1, 'M', 'Mem', 'm@test.local'), (2, 1, 'O', 'Other', 'o@test.local');
    `);
    const push = await import("@/lib/push");
    const good = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";
    const gone = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]";
    expect(push.isExpoToken(good)).toBe(true);
    expect(push.isExpoToken("not a token")).toBe(false);
    push.saveAppToken(1, good, "ios");
    push.saveAppToken(1, gone, "android");
    // A phone moves to whoever signs in on it.
    push.saveAppToken(2, "ExponentPushToken[cccccccccccccccccccccc]", "ios");
    push.saveAppToken(1, "ExponentPushToken[cccccccccccccccccccccc]", "ios");
    push.removeAppToken("ExponentPushToken[cccccccccccccccccccccc]", 2); // not theirs any more: no effect
    expect(d.prepare("SELECT COUNT(*) AS n FROM native_push_tokens WHERE member_id = 1").get()).toEqual({ n: 3 });
    push.removeAppToken("ExponentPushToken[cccccccccccccccccccccc]");

    const fetchMock = vi.fn(async () =>
      Response.json({ data: [{ status: "ok", id: "x" }, { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await push.pushToMember(1, { title: "Lesson Sunday", body: "Faith", url: "/lessons/3?n=9" })).toBe(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(JSON.parse(String(init.body))).toEqual([
      { to: good, title: "Lesson Sunday", body: "Faith", data: { url: "https://mywardlink.net/lessons/3?n=9" }, sound: "default", priority: "high", channelId: "default" },
      { to: gone, title: "Lesson Sunday", body: "Faith", data: { url: "https://mywardlink.net/lessons/3?n=9" }, sound: "default", priority: "high", channelId: "default" },
    ]);
    expect((d.prepare("SELECT token FROM native_push_tokens").all() as { token: string }[]).map((r) => r.token)).toEqual([good]);
  });

  it("doesn't also send to an old Home Screen sign-up on an Apple device when they have the iPhone app", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name) VALUES (1, 'W');
      INSERT INTO members (id, ward_id, name, display_name, email) VALUES (1, 1, 'M', 'Mem', 'm@test.local');
    `);
    const push = await import("@/lib/push");
    const webpush = (await import("web-push")).default;
    const sent: string[] = [];
    const spy = vi.spyOn(webpush, "sendNotification").mockImplementation(async (sub) => {
      sent.push(sub.endpoint);
      return { statusCode: 201, body: "", headers: {} };
    });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [{ status: "ok", id: "x" }] })));
    d.exec(`INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth) VALUES
      (1, 'https://web.push.apple.com/QAbc', 'k', 'a'),
      (1, 'https://fcm.googleapis.com/fcm/send/xyz', 'k', 'a')`);
    // Website only: both get it.
    await push.pushToMember(1, { title: "T", body: "B", url: "/" });
    expect(sent.sort()).toEqual(["https://fcm.googleapis.com/fcm/send/xyz", "https://web.push.apple.com/QAbc"]);
    // With the iPhone app: the app, plus the computer's browser, but not the Apple web sign-up.
    sent.length = 0;
    push.saveAppToken(1, "ExponentPushToken[dddddddddddddddddddddd]", "ios");
    expect(await push.pushToMember(1, { title: "T", body: "B", url: "/" })).toBe(2);
    expect(sent).toEqual(["https://fcm.googleapis.com/fcm/send/xyz"]);
    spy.mockRestore();
  });
});
