const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN || "";
const REPLIT_DOMAINS = process.env.REPLIT_DOMAINS || "";

const origin = REPLIT_DOMAINS
  ? `https://${REPLIT_DOMAINS.split(",")[0].trim()}`
  : REPLIT_DEV_DOMAIN
  ? `https://${REPLIT_DEV_DOMAIN}`
  : "https://sgaa.angola.ao";

module.exports = {
  expo: {
    name: "QUETA School Completo",
    slug: "queta-school",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "queta",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#FFFFFF",
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
        backgroundColor: "#FFFFFF",
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
      [
        "expo-camera",
        {
          cameraPermission:
            "Necessário para digitalizar códigos QR e tirar fotografias.",
          microphonePermission:
            "Necessário para gravar vídeo.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Permite seleccionar fotografias da galeria.",
          cameraPermission:
            "Permite tirar fotografias directamente.",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Permite aceder à localização para funcionalidades geográficas.",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: false,
    },
    extra: {
      eas: {
        projectId: "d0396d29-96bc-4aec-a943-0dfdda692205",
      },
    },
  },
};
