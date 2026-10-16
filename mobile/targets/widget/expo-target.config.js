// The home-screen widget (iPhone). Built into the app by @bacons/apple-targets
// during the EAS build; the Swift code is in this folder.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "widget",
  displayName: "My Ward Link",
  icon: "../../assets/icon.png",
  // containerBackground and the newer widget layouts need iOS 17.
  deploymentTarget: "17.0",
  colors: {
    $accent: { light: "#1d5f99", dark: "#7fb0d8" },
    WardBackground: { light: "#ffffff", dark: "#16202b" },
    WardText: { light: "#1f2933", dark: "#e6ebf0" },
    WardMuted: { light: "#5f6b76", dark: "#9aa7b4" },
    WardAccent: { light: "#1d5f99", dark: "#7fb0d8" },
    WardBadge: { light: "#c0392b", dark: "#e5534b" },
  },
  entitlements: {
    // Shares the widget key with the app.
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
