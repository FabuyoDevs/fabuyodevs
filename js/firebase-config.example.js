import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "PASTE_FIREBASE_API_KEY",
  authDomain: "PASTE_FIREBASE_AUTH_DOMAIN",
  projectId: "PASTE_FIREBASE_PROJECT_ID",
  storageBucket: "PASTE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "PASTE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "PASTE_FIREBASE_APP_ID",
  measurementId: "PASTE_FIREBASE_MEASUREMENT_ID",
};

export const isFirebaseConfigured = !Object.values(firebaseConfig).some(
  (value) => !value || String(value).includes("PASTE_")
);

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };
export const PROJECTS_COLLECTION = "projects";
export const INQUIRIES_COLLECTION = "inquiries";
export const STORAGE_FOLDER = "portfolio";
export const IMAGE_RULES = {
  maxBytes: 5 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
  extensions: [".jpg", ".jpeg", ".png", ".webp"],
};
export const CATEGORIES = ["E-commerce", "Corporate", "Service", "Creative"];