const IS_DEV = process.env.NODE_ENV !== "production";
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN || "";
const REPLIT_DOMAINS = process.env.REPLIT_DOMAINS || "";

const origin = REPLIT_DOMAINS
  ? `https://${REPLIT_DOMAINS.split(",")[0].trim()}`
  : REPLIT_DEV_DOMAIN
  ? `https://${REPLIT_DEV_DOMAIN}`
  : "https://localhost:5000";

module.exports = {
  expo: {
    name: "SGAA Angola",
    slug: "sgaa-angola",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "sgaa",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0D1B3E",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.sgaa.angola",
      infoPlist: {
        NSFaceIDUsageDescription:
          "Utilize o Face ID para aceder à sua conta de forma segura.",
        NSCameraUsageDescription:
          "Necessário para digitalizar códigos QR e tirar fotografias.",
      },
    },
    android: {
      package: "com.sgaa.angola",
      adaptiveIcon: {
        backgroundColor: "#0D1B3E",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      permissions: [
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
        "android.permission.CAMERA",
      ],
    },
    web: {
      favicon: "./assets/images/favicon.png",
      bundler: "metro",
      output: "single",
    },
    plugins: [
      [
        "expo-router",
        {
          origin,
        },
      ],
      "expo-font",
      "expo-web-browser",
      "expo-local-authentication",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
