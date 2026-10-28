/* ============================================================
   api/_lib/auth.js — ID token verify, প্রোফাইল/রোল যাচাই,
   অডিট লগ ও লেনদেন হেল্পার (Admin SDK — rules bypass, কিন্তু
   প্রতিটি অপারেশন এখানে হার্ড-কোডেড বিজনেস রুল মেনে চলে)
   ============================================================ */
const { getAdmin } = require("./admin.js");

const AUTH_ERRORS = {
  "auth/id-token-expired": "সেশন শেষ — আবার লগইন করুন",
  "auth/argument-error": "অবৈধ অথ টোকেন",
};

async function verifyUser(req) {
  const admin = await getAdmin();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "অথ টোকেন অনুপস্থিত", status: 401 };
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token, true);
  } catch (e) {
    return { error: AUTH_ERRORS[e.code] || "অথ যাচাই ব্যর্থ — আবার লগইন করুন", status: 401 };
  }
  const uid = decoded.uid;
  const snap = await admin.database().ref(`users/${uid}`).get();
  const profile = snap.exists() ? snap.val() : null;
  if (!profile) return { error: "প্রোফাইল পাওয়া যায়নি — আবার লগইন করুন", status: 403 };
  if (profile.status === "blocked") return { error: "আপনার অ্যাকাউন্ট ব্লক করা হয়েছে", status: 403 };
  return { uid, profile, email: decoded.email || profile.email || "" };
}

async function requireAdmin(req) {
  const base = await verifyUser(req);
  if (base.error) return base;
  if (base.profile.role !== "admin") return { error: "শুধুমাত্র Admin এই অ্যাকশন নিতে পারেন", status: 403 };
  return base;
}

async function audit(action, target, details, adminUid, adminEmail) {
  const admin = await getAdmin();
  await admin.database().ref("adminAuditLogs").push({
    action, target: target || "", details: details || "",
    adminUid: adminUid || "", adminEmail: adminEmail || "", at: Date.now(),
  });
}

/** লেনদেন রেকর্ড (প্রতিটি টাকা-আসা-যাওয়ার রেকর্ড) */
async function tx(uid, amount, type, title, reference, status) {
  const admin = await getAdmin();
  await admin.database().ref(`transactions/${uid}`).push({
    amount: Math.round(Number(amount) * 100) / 100,
    type, title: title || type, reference: reference || "",
    status: status || "success", timestamp: Date.now(),
  });
}

async function notify(uid, type, title, body) {
  const admin = await getAdmin();
  await admin.database().ref(`notifications/${uid}`).push({
    type, title, body: body || "", read: false, createdAt: Date.now(),
  });
}

function round2(n) { return Math.round(Number(n) * 100) / 100; }

module.exports = { verifyUser, requireAdmin, audit, tx, notify, round2 };
