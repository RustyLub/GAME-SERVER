import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Public Firebase Web App configuration. Environment variables take precedence,
// so the project can be changed later without editing application code.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAdWMYqPO1mgx2h2DO3Iw8XZxEyZJQitO0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "rustylub.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "rustylub",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "rustylub.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "835038801032",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:835038801032:web:643113413df82f7af9033d",
};

const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
];

export const isFirebaseConfigured = requiredConfig.every(
  (value) => typeof value === "string" && value.length > 0,
);

const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseApp = app;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
