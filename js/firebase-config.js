/**
 * ==========================================================================
 * FABUYO — Firebase Configuration & Initialization
 * --------------------------------------------------------------------------
 * Firebase Web SDK v10 (modular, API-compatible with v9).
 *
 * SETUP:
 *   1. Create a project at https://console.firebase.google.com
 *   2. Add a "Web App" and copy the generated config object.
 *   3. Paste your credentials below, replacing every PASTE_* placeholder.
 *   4. Enable "Email/Password" in  Authentication → Sign-in method.
 *   5. Create Firestore Database and a Storage bucket (see README.md
 *      for the required security rules).
 *
 * NOTE: The public site gracefully falls back to demo portfolio data
 *       while the placeholders are untouched. The admin portal requires
 *       a valid configuration before it can be used.
 * ==========================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/** ------------------------------------------------------------------
 *  YOUR FIREBASE PROJECT CREDENTIALS  →  paste them here
 *  Firebase Console → Project Settings → General → "Your apps" → SDK
 * ------------------------------------------------------------------ */
export const firebaseConfig = {
 apiKey: "AIzaSyCM-ocsagK3a8OL5AZQrIZHWyHjLF5TCis",
  authDomain: "fabuyodevdb.firebaseapp.com",
  projectId: "fabuyodevdb",
  storageBucket: "fabuyodevdb.firebasestorage.app",
  messagingSenderId: "623308055736",
  appId: "1:623308055736:web:39f39bd2f3ee19fd35404d",
  measurementId: "G-Y4D5LGJ5V1"
};

/**
 * Helper flag — true only when every placeholder has been replaced.
 * Used by app.js (demo-data fallback) and admin.js (setup notice).
 */
export const isFirebaseConfigured = !Object.values(firebaseConfig).some(
  (value) => !value || String(value).includes("PASTE_")
);

/* Initialize the app + services only when real credentials exist.
   Exports stay null otherwise so callers can branch safely. */
let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else {
  console.info(
    "%c[Fabuyo] Firebase is not configured yet — public pages run in demo mode. " +
      "Paste your credentials into js/firebase-config.js to go live.",
    "color:#d5ff4f"
  );
}

export { app, auth, db, storage };

/* ------------------------------------------------------------------
 * Shared constants
 * ------------------------------------------------------------------ */
export const PROJECTS_COLLECTION = "projects";   // portfolio metadata
export const INQUIRIES_COLLECTION = "inquiries"; // public contact leads
export const STORAGE_FOLDER = "portfolio";       // screenshot uploads

/** Allowed screenshot constraints (mirrored by Storage security rules). */
export const IMAGE_RULES = {
  maxBytes: 5 * 1024 * 1024, // 5 MB
  types: ["image/jpeg", "image/png", "image/webp"],
  extensions: [".jpg", ".jpeg", ".png", ".webp"],
};

/** Canonical category list used by filters + the admin form. */
export const CATEGORIES = ["E-commerce", "Corporate", "Service", "Creative"];
