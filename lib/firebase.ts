import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

type FirebaseRequiredConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

type FirebaseRuntimeConfig = {
  requiredConfig: FirebaseRequiredConfig;
  config: FirebaseRequiredConfig & { measurementId?: string };
  missingKeys: string[];
  configured: boolean;
};

const firebaseConfigKeyToEnvName: Record<keyof FirebaseRequiredConfig, string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

let firebaseApp: FirebaseApp | null = null;
let firebaseAnalytics: Analytics | null = null;
let firebaseWarningShown = false;
let firebaseEnvDebugLogged = false;

const readEnvValue = (value: string | undefined): string => {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

const maskEnvValue = (value: string): string => {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-2)}`;
};

export const getFirebaseConfig = (): FirebaseRuntimeConfig => {
  const requiredConfig: FirebaseRequiredConfig = {
    apiKey: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };

  const missingKeys = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => firebaseConfigKeyToEnvName[key as keyof FirebaseRequiredConfig]);

  return {
    requiredConfig,
    config: {
      ...requiredConfig,
      measurementId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) || undefined,
    },
    missingKeys,
    configured: missingKeys.length === 0,
  };
};

const logFirebaseEnvDebug = (runtimeConfig: FirebaseRuntimeConfig) => {
  if (firebaseEnvDebugLogged || typeof window === "undefined") {
    return;
  }

  console.log("Firebase Project:", runtimeConfig.requiredConfig.projectId);

  console.info("[firebase] env debug", {
    configured: runtimeConfig.configured,
    missingKeys: runtimeConfig.missingKeys,
    values: {
      NEXT_PUBLIC_FIREBASE_API_KEY: maskEnvValue(runtimeConfig.requiredConfig.apiKey),
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: runtimeConfig.requiredConfig.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: runtimeConfig.requiredConfig.projectId,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: runtimeConfig.requiredConfig.storageBucket,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: maskEnvValue(runtimeConfig.requiredConfig.messagingSenderId),
      NEXT_PUBLIC_FIREBASE_APP_ID: maskEnvValue(runtimeConfig.requiredConfig.appId),
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: maskEnvValue(runtimeConfig.config.measurementId || ""),
    },
  });

  firebaseEnvDebugLogged = true;
};

export const isFirebaseConfigured = (): boolean => {
  return getFirebaseConfig().configured;
};

export const getFirebaseApp = (): FirebaseApp | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const runtimeConfig = getFirebaseConfig();
  logFirebaseEnvDebug(runtimeConfig);

  if (!runtimeConfig.configured) {
    if (!firebaseWarningShown) {
      console.warn("[firebase] config missing. Firebase disabled on this client runtime.", {
        missingKeys: runtimeConfig.missingKeys,
      });
      firebaseWarningShown = true;
    }

    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    firebaseApp = getApps().length ? getApp() : initializeApp(runtimeConfig.config);
    return firebaseApp;
  } catch (error) {
    if (!firebaseWarningShown) {
      console.warn("[firebase] app initialization failed. Continuing without Firebase.", { error });
      firebaseWarningShown = true;
    }

    return null;
  }
};

export const getFirebaseAuth = () => {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
};

export const getFirebaseDb = () => {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
};

export const getFirebaseStorage = () => {
  const app = getFirebaseApp();
  return app ? getStorage(app) : null;
};

export const getFirebaseAnalytics = async (): Promise<Analytics | null> => {
  const app = getFirebaseApp();

  if (!app || typeof window === "undefined") {
    return null;
  }

  if (firebaseAnalytics) {
    return firebaseAnalytics;
  }

  try {
    const supported = await isSupported();

    if (!supported) {
      return null;
    }

    firebaseAnalytics = getAnalytics(app);
    return firebaseAnalytics;
  } catch {
    return null;
  }
};
