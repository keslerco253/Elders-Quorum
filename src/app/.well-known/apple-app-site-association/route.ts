// Lets links to this site open in the My Ward Link iPhone app (universal
// links). Needs APPLE_TEAM_ID (from developer.apple.com → Membership).
// Calendar feeds, files and the API stay in Safari / the Calendar app.
export function GET() {
  const team = process.env.APPLE_TEAM_ID?.trim();
  if (!team) return new Response("Not found", { status: 404 });
  return Response.json({
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
