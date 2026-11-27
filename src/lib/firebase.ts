import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore/lite";

// Firebase Web App values are public client configuration, not secrets.
// Reuse the existing Rusty.Lub Firebase Web App unless GitHub Variables or
// a local .env file explicitly overrides these public client values.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAdWMYqPO1mgx2h2DO3Iw8XZxEyZJQitO0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "rustylub.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "rustylub",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "rustylub.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "835038801032",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:835038801032:web:643113413df82f7af9033d",
};

const requiredConfig = Object.values(firebaseConfig);
export const isFirebaseConfigured = requiredConfig.every(
  (value) => typeof value === "string" && value.trim().length > 0,
);

const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseApp = app;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
