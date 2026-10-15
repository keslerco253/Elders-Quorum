// Lets links to this site open in the My Ward Link iPhone app (universal
// links), and lets the app fill in texted sign-in codes, which are tied to this
// site ("@mywardlink.net #123456"); iPhones only offer such a code in an app
// listed here. Needs APPLE_TEAM_ID (from developer.apple.com → Membership).
// Calendar feeds, files and the API stay in Safari / the Calendar app.
export function GET() {
  const team = process.env.APPLE_TEAM_ID?.trim();
  if (!team) return new Response("Not found", { status: 404 });
  return Response.json({
    webcredentials: { apps: [`${team}.net.mywardlink.app`] },
    applinks: {
      details: [
        {
          appIDs: [`${team}.net.mywardlink.app`],
          components: [
            { "/": "/feed/*", exclude: true },
            { "/": "/calendar/*/ics", exclude: true },
            { "/": "/files/*", exclude: true },
            { "/": "/api/*", exclude: true },
            { "/": "/*" },
          ],
        },
      ],
    },
  });
}
