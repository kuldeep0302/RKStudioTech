import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const requiredFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseConfig = {
  ...requiredFirebaseConfig,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Object.values(requiredFirebaseConfig).every(Boolean);

let firebaseApp: FirebaseApp | null = null;
let firebaseAnalytics: Analytics | null = null;

export const getFirebaseApp = (): FirebaseApp | null => {
  if (!isFirebaseConfigured) {
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
