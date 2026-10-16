// The My Ward Link phone app. It shows the web app's pages (APP_URL) inside a
// native app: a native tab bar, push notifications and the icon badge, the share
// sheet, Face ID lock, links that open in the right place, and the Android back
// button. Built in the cloud with EAS (no Mac).
const fs = require("fs");

const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || "https://mywardlink.net").replace(/\/+$/, "");
const host = new URL(APP_URL).host;
// From Firebase, for Android notifications (see docs/MOBILE-APP.md). Builds
// still work without it; Android just won't get notifications.
const googleServices = fs.existsSync("./google-services.json") ? "./google-services.json" : undefined;

module.exports = {
  expo: {
    name: "My Ward Link",
    slug: "my-ward-link",
    scheme: "mywardlink",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: "net.mywardlink.app",
      supportsTablet: true,
      // Links to the site (e.g. sign-in emails) open in the app, and texted sign-in
      // codes ("@mywardlink.net #123456") are offered above the keyboard.
      associatedDomains: [`applinks:${host}`, `webcredentials:${host}`],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // Attaching a picture to a plan (the web page's file picker) can open these.
        NSPhotoLibraryUsageDescription: "Lets you attach pictures, like a plan or flyer, for your ward.",
        NSCameraUsageDescription: "Lets you take a picture to attach, like a plan or flyer, for your ward.",
      },
    },
    android: {
      package: "net.mywardlink.app",
      adaptiveIcon: {
        backgroundColor: "#1d3a5f",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      ...(googleServices ? { googleServicesFile: googleServices } : {}),
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [{ scheme: "https", host }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 160,
          resizeMode: "contain",
          backgroundColor: "#f6f5f2",
          dark: { image: "./assets/splash-icon.png", backgroundColor: "#0e151d" },
        },
      ],
      [
        "expo-local-authentication",
        { faceIDPermission: "Lets you lock My Ward Link with Face ID, so only you can see your ward's messages." },
      ],
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#1d3a5f",
        },
      ],
    ],
    extra: {
      appUrl: APP_URL,
      // The Expo (EAS) project, from `eas init`.
      eas: { projectId: process.env.EAS_PROJECT_ID || "b83853d0-fb41-4b2e-a9d6-2317b89ab86f" },
    },
  },
};
