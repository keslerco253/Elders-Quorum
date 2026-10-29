// Lets links to this site open in the My Ward Link Android app (app links).
// Needs ANDROID_CERT_SHA256: the app signing certificate's SHA-256 fingerprint
// (from Google Play Console → App integrity, or `eas credentials`); several
// can be separated by commas.
export function GET() {
  const prints = (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (!prints.length) return new Response("Not found", { status: 404 });
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: "com.mywardlink.app", sha256_cert_fingerprints: prints },
    },
  ]);
}
