const fs = require("node:fs");
const path = require("node:path");

const requiredVariables = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  projectId: "FIREBASE_PROJECT_ID",
  storageBucket: "FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
  appId: "FIREBASE_APP_ID",
};

const missing = Object.values(requiredVariables).filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing Firebase build variables: ${missing.join(", ")}`);
}

const config = Object.fromEntries(
  Object.entries(requiredVariables).map(([key, name]) => [key, process.env[name]])
);
config.measurementId = process.env.FIREBASE_MEASUREMENT_ID || "";

const output = `import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

export const firebaseConfig = ${JSON.stringify(config, null, 2)};
export const isFirebaseConfigured = true;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
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