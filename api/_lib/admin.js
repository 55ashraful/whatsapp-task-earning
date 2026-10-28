/* ============================================================
   api/_lib/admin.js — Firebase Admin SDK bootstrap (server-only)
   ------------------------------------------------------------
   Credentials আসে Vercel Environment Variables থেকে:
     FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
   Service-account key কখনো git/ZIP-এ রাখা হয় না।
   ============================================================ */
let cached = null;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`Missing environment variable: ${name} — Vercel Project Settings → Environment Variables এ সেট করুন (.env.example দেখুন)`);
    err.code = "ENV_MISSING";
    throw err;
  }
  return v;
}

function getServiceAccount() {
  return {
    type: "service_account",
    project_id: requireEnv("FIREBASE_PROJECT_ID"),
    client_email: requireEnv("FIREBASE_CLIENT_EMAIL"),
    private_key: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}

async function getAdmin() {
  if (cached) return cached;
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(getServiceAccount()),
      databaseURL: process.env.FIREBASE_DATABASE_URL || undefined,
    });
  }
  cached = admin;
  return admin;
}

module.exports = { getAdmin };
