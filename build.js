const fs = require("node:fs");
const path = require("node:path");

const requiredVariables = {
  apiKey: ["FIREBASE_API_KEY", "apiKey"],
  authDomain: ["FIREBASE_AUTH_DOMAIN", "authDomain"],
  projectId: ["FIREBASE_PROJECT_ID", "projectId"],
  storageBucket: ["FIREBASE_STORAGE_BUCKET", "storageBucket"],
  messagingSenderId: ["FIREBASE_MESSAGING_SENDER_ID", "messagingSenderId"],
  appId: ["FIREBASE_APP_ID", "appId"],
};

const getEnvironmentValue = (names) =>
  names.map((name) => process.env[name]).find(Boolean);
const missing = Object.values(requiredVariables)
  .filter((names) => !getEnvironmentValue(names))
  .map((names) => names[0]);
const hasFirebaseConfig = missing.length === 0;

if (!hasFirebaseConfig) {
  console.warn(
    `Firebase environment variables are not configured; building demo mode. Missing: ${missing.join(", ")}`
  );
}

const config = Object.fromEntries(
  Object.entries(requiredVariables).map(([key, names]) => [
    key,
    getEnvironmentValue(names) || `PASTE_${names[0]}`,
  ])
);
config.measurementId = process.env.FIREBASE_MEASUREMENT_ID || process.env.measurementId || "";

const output = `import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

export const firebaseConfig = ${JSON.stringify(config, null, 2)};
export const isFirebaseConfigured = ${hasFirebaseConfig};

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
`;

fs.writeFileSync(path.join(__dirname, "js", "firebase-config.js"), output, "utf8");
console.log("Generated js/firebase-config.js from Vercel environment variables.");