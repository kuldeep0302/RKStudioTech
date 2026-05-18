import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const requiredFirebaseEnvKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

const requiredFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

const firebaseConfig = {
  ...requiredFirebaseConfig,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseMissingEnvKeys = requiredFirebaseEnvKeys.filter((key) => {
  const value = process.env[key];
  return !value || !value.trim();
});

export const isFirebaseConfigured = firebaseMissingEnvKeys.length === 0;

let firebaseApp: FirebaseApp | null = null;
let firebaseAnalytics: Analytics | null = null;
let firebaseConfigWarningShown = false;

export const getFirebaseApp = (): FirebaseApp | null => {
  if (!isFirebaseConfigured) {
    if (!firebaseConfigWarningShown) {
      console.warn("Firebase config missing. Check env variables.");
      firebaseConfigWarningShown = true;
    }

    return null;
  }

  if (!firebaseApp) {
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
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
