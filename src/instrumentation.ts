// A server the app has moved away from (MOVED_TO) sends no reminders or texts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DISABLE_SCHEDULER !== "1" && !process.env.MOVED_TO) {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
