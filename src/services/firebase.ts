import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const legacyFirebaseEnvAliases: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_APIKEY: "NEXT_PUBLIC_FIREBASE_API_KEY",
  NEXT_PUBLIC_FIREBASE_AUTHDOMAIN: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  NEXT_PUBLIC_FIREBASE_PROJECTID: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  NEXT_PUBLIC_FIREBASE_STORAGEBUCKET: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  NEXT_PUBLIC_FIREBASE_MESSAGINGSENDERID: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  NEXT_PUBLIC_FIREBASE_APPID: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

const firebaseConfigKeyToEnvName = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
} as const;

let firebaseApp: FirebaseApp | null = null;
let firebaseAnalytics: Analytics | null = null;
let firebaseConfigWarningShown = false;
let firebaseEnvDebugLogged = false;

type FirebaseConfigValidation = {
  missingKeys: string[];
  invalidKeys: string[];
  valid: boolean;
};

type FirebaseRuntimeConfig = {
  requiredConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  missingKeys: string[];
  configured: boolean;
};

const readEnvValue = (value: string | undefined): string => {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  // Handle accidental quoted values copied into env vars.
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

export const getFirebaseConfig = (): FirebaseRuntimeConfig => {
  const requiredConfig = {
    apiKey: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };

  const config = {
    ...requiredConfig,
    measurementId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) || undefined,
  };

  const missingKeys = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => firebaseConfigKeyToEnvName[key as keyof typeof firebaseConfigKeyToEnvName]);

  return {
    requiredConfig,
    config,
    missingKeys,
    configured: missingKeys.length === 0,
  };
};

export const isFirebaseConfigured = (): boolean => {
  return getFirebaseConfig().configured;
};

const maskEnvValue = (value: string | undefined): string => {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-2)}`;
};

const logFirebaseEnvDebug = (runtimeConfig: FirebaseRuntimeConfig) => {
  if (firebaseEnvDebugLogged || typeof window === "undefined") {
    return;
  }

  const debugValues = {
    NEXT_PUBLIC_FIREBASE_API_KEY: maskEnvValue(runtimeConfig.config.apiKey),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: runtimeConfig.config.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: runtimeConfig.config.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: runtimeConfig.config.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: maskEnvValue(runtimeConfig.config.messagingSenderId),
    NEXT_PUBLIC_FIREBASE_APP_ID: maskEnvValue(runtimeConfig.config.appId),
  };

  const legacyKeysFound = Object.keys(legacyFirebaseEnvAliases).filter((legacyKey) => {
    const value = process.env[legacyKey as keyof NodeJS.ProcessEnv];
    return Boolean(value && value.trim());
  });

  console.info("[firebase] env debug", {
    configured: runtimeConfig.configured,
    missingKeys: runtimeConfig.missingKeys,
    values: debugValues,
  });

  if (legacyKeysFound.length > 0) {
    console.warn("[firebase] legacy env key names found. Use exact names instead.", {
      legacyKeysFound,
      expectedNames: legacyKeysFound.map((legacyKey) => legacyFirebaseEnvAliases[legacyKey]),
    });
  }

  firebaseEnvDebugLogged = true;
};

const validateFirebaseConfig = (requiredConfig: FirebaseRuntimeConfig["requiredConfig"]): FirebaseConfigValidation => {
  const missingKeys = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const invalidKeys: string[] = [];

  if (requiredConfig.authDomain && !requiredConfig.authDomain.endsWith("firebaseapp.com")) {
    invalidKeys.push("authDomain (must end with firebaseapp.com)");
  }

  if (
    requiredConfig.storageBucket
    && !(
      requiredConfig.storageBucket.endsWith("appspot.com")
      || requiredConfig.storageBucket.endsWith("firebasestorage.app")
    )
  ) {
    invalidKeys.push("storageBucket (must end with appspot.com or firebasestorage.app)");
  }

  return {
    missingKeys,
    invalidKeys,
    valid: missingKeys.length === 0 && invalidKeys.length === 0,
  };
};

export const getFirebaseApp = (): FirebaseApp | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const runtimeConfig = getFirebaseConfig();

  logFirebaseEnvDebug(runtimeConfig);

  if (!runtimeConfig.config.apiKey || !runtimeConfig.config.projectId) {
    console.error("Invalid Firebase config", runtimeConfig.config);
  }

  const validation = validateFirebaseConfig(runtimeConfig.requiredConfig);

  if (!validation.valid) {
    if (!firebaseConfigWarningShown) {
      console.error("[firebase] config validation failed", {
        missingKeys: validation.missingKeys,
        invalidKeys: validation.invalidKeys,
        config: runtimeConfig.config,
      });
      firebaseConfigWarningShown = true;
    }

    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[firebase] config (masked)", {
      apiKey: maskEnvValue(runtimeConfig.config.apiKey),
      authDomain: runtimeConfig.config.authDomain,
      projectId: runtimeConfig.config.projectId,
      storageBucket: runtimeConfig.config.storageBucket,
      messagingSenderId: maskEnvValue(runtimeConfig.config.messagingSenderId),
      appId: maskEnvValue(runtimeConfig.config.appId),
      measurementId: runtimeConfig.config.measurementId || "",
    });
  }

  if (!firebaseApp) {
    if (!getApps().length) {
      firebaseApp = initializeApp(runtimeConfig.config);
    } else {
      firebaseApp = getApp();
    }
  }

  return firebaseApp;
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

  const supported = await isSupported();

  if (!supported) {
    return null;
  }

  firebaseAnalytics = getAnalytics(app);

  return firebaseAnalytics;
};
