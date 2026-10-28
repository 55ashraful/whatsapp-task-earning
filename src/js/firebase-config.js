/* ============================================================
   firebase-config.js — Firebase Web SDK bootstrap
   ------------------------------------------------------------
   ⚠ নিরাপত্তা নোট: Firebase "Web Configuration" (apiKey, projectId
   ইত্যাদি) গোপনীয় তথ্য নয় — এটি ব্রাউজারে প্রকাশিত থাকার কথাই।
   প্রকৃত নিরাপত্তা নিশ্চিত করে:
     1) Firebase Authentication (শুধু ভেরিফাইড ব্যবহারকারী)
     2) Realtime Database Security Rules (firebase/database.rules.json)
     3) Vercel Serverless API (সব টাকা-সংক্রান্ত লেনদেন server-side)
   বিস্তারিত: README.md ও firebase/README.md
   ============================================================ */

// ▼▼▼ আপনার Firebase Project Web Config (ইতিমধ্যে বসানো আছে ✓) ▼▼▼
// পরিবর্তন করতে চাইলে: Firebase Console → Project settings → General → Your apps → Web app
export const firebaseConfig = {
  apiKey: "AIzaSyC2rZpLvt49d5SwPiU3oOgHbifUEniZia8",
  authDomain: "whatsapp-tacks.firebaseapp.com",
  databaseURL: "https://whatsapp-tacks-default-rtdb.firebaseio.com",
  projectId: "whatsapp-tacks",
  storageBucket: "whatsapp-tacks.firebasestorage.app",
  messagingSenderId: "866275351142",
  appId: "1:866275351142:web:3c3d7c81113b93a0b2eba7",
  measurementId: "G-M2C4RP8J44",
};

// সাপোর্ট/যোগাযোগ ইমেইল (Settings থেকেও পরিবর্তনযোগ্য)
export const SUPPORT_EMAIL = "ashrafulhaqedulon@gmail.com";

const PLACEHOLDER = "REPLACE_WITH_YOUR_";

/** কনফিগ বসানো হয়েছে কি না (placeholder থাকলে false) */
export function isFirebaseConfigured() {
  if (!firebaseConfig || typeof firebaseConfig !== "object") return false;
  const keys = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
  return keys.every((k) => {
    const v = firebaseConfig[k];
    return typeof v === "string" && v.length > 0 && !v.startsWith(PLACEHOLDER);
  });
}

export const CONFIG_ERROR_KEY = "firebase_config_missing";

let app = null;
let authInstance = null;
let dbInstance = null;

/**
 * Firebase চালু করে { app, auth, db } দেয়।
 * কনফিগ না থাকলে CONFIG_ERROR_KEY error ছুড়ে দেয় —
 * app.js সেটি ধরে ব্যবহারকারীকে বন্ধুত্বপূর্ণ নির্দেশনা দেখায় (সাদা স্ক্রিন হয় না)।
 */
export async function initFirebase() {
  if (!isFirebaseConfigured()) {
    const err = new Error(
      "Firebase কনফিগার করা হয়নি। src/js/firebase-config.js ফাইলে আপনার Firebase Web Config বসান (README.md দেখুন)।"
    );
    err.code = CONFIG_ERROR_KEY;
    throw err;
  }
  if (app) return { app, auth: authInstance, db: dbInstance };
  try {
    const [{ initializeApp }, authMod, dbMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"),
    ]);
    app = initializeApp(firebaseConfig);
    authInstance = authMod.getAuth(app);
    dbInstance = dbMod.getDatabase(app);
    return { app, auth: authInstance, db: dbInstance };
  } catch (e) {
    console.error("[firebase-config] init failed:", e);
    const err = new Error(
      "Firebase লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন বা CDN ব্লক আছে কি না দেখুন।"
    );
    err.code = "firebase_init_failed";
    err.cause = e;
    throw err;
  }
}

/** সংক্ষিপ্ত accessor — app.js init-এর পরে ব্যবহারযোগ্য */
export function getAuthInstance() {
  if (!authInstance) throw new Error("Firebase Auth এখনও init হয়নি");
  return authInstance;
}
export function getDb() {
  if (!dbInstance) throw new Error("Firebase Realtime Database এখনও init হয়নি");
  return dbInstance;
}
