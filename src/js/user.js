/* ============================================================
   user.js — ইউজার প্রোফাইল তৈরি/পড়া/আপডেট + সাধারণ DB হেল্পার
   ============================================================ */
import { getAuthInstance, getDb } from "./firebase-config.js";
import { ref, get, set, update, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { genReferralCode, toast } from "./utils.js";

let profileCache = null;
export function getUserProfile() { return profileCache; }
export function setProfileCache(p) { profileCache = p; }
export function clearProfileCache() { profileCache = null; }

/**
 * লগইন/রেজিস্ট্রেশনের পরে প্রোফাইল আছে কি না নিশ্চিত করে।
 * Email/password রেজিস্ট্রেশনে auth.js আগেই প্রোফাইল তৈরি করে;
 * Google first-login-এ এখানে অ্যাকাউন্ট pendingRole অবস্থায় তৈরি হয় এবং
 * ব্যবহারকারী রোল বেছে নেয় (profile.js completeGoogleSignup)।
 * RTDB rules এই গঠন যাচাই করে — role সরাসরি 'admin' দেওয়া যাবে না।
 */
export async function ensureUserProfile(user) {
  const db = getDb();
  const userRef = ref(db, `users/${user.uid}`);
  const snap = await get(userRef);
  if (snap.exists()) {
    profileCache = snap.val();
    return profileCache;
  }
  const code = genReferralCode();
  const profile = {
    uid: user.uid,
    displayName: user.displayName || (user.email ? user.email.split("@")[0] : "User"),
    email: user.email || "",
    photoURL: user.photoURL || "",
    role: "pending",                 // Google sign-up: ব্যবহারকারী পরে buyer/worker বেছে নেয়
    status: "active",
    createdAt: serverTimestamp(),
    referralCode: code,
    referredBy: "",
    whatsapp: { number: "", linkedAt: 0 },
    language: localStorage.getItem("wte_lang") || "bn",
  };
  // multipath: users + referralCodes একসাথে (rules উভয় যাচাই করে)
  const updates = {};
  updates[`users/${user.uid}`] = profile;
  updates[`referralCodes/${code}`] = user.uid;
  await update(ref(db), updates);
  profileCache = profile;
  return profile;
}

export function watchUserProfile(uid, cb) {
  const db = getDb();
  const userRef = ref(db, `users/${uid}`);
  const unsub = onValue(userRef, (snap) => {
    if (snap.exists()) { profileCache = snap.val(); if (cb) cb(profileCache); }
  }, (err) => console.error("[user watch]", err));
  return unsub;
}

/** রোল নির্বাচন সম্পন্ন করা (Google first-login) — একবারই সেট করা যায় */
export async function completeRoleSelection(uid, role) {
  if (!["buyer", "worker"].includes(role)) throw new Error("অবৈধ ভূমিকা");
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}/role`));
  if (snap.exists() && ["buyer", "worker"].includes(snap.val())) {
    profileCache = { ...profileCache, role: snap.val() };
    return; // ইতিমধ্যে নির্ধারিত
  }
  await update(ref(db, `users/${uid}`), { role });
  profileCache = { ...profileCache, role };
}

export async function updateOwnProfile(uid, patch) {
  // rules নিশ্চিত করে role/status/balance জাতীয় ঘর ক্লায়েন্ট থেকে বদলানো যায় না
  const db = getDb();
  await update(ref(db, `users/${uid}`), patch);
  profileCache = { ...profileCache, ...patch };
}

export async function bindWhatsappNumber(uid, normalized) {
  const db = getDb();
  await update(ref(db, `users/${uid}/whatsapp`), { number: normalized, linkedAt: serverTimestamp() });
  profileCache = { ...profileCache, whatsapp: { number: normalized, linkedAt: Date.now() } };
}

/** সেটিংস (সব authenticated পড়তে পারে) — default সহ */
export const DEFAULT_SETTINGS = {
  referralBonusPerFriend: 20,
  referIncomePercent: 5,
  referTransferMin: 50,
  spinFreeDaily: 3,
  spinCooldownMinutes: 120,
  paidSpinCost: 20,
  minDeposit: 100,
  minWithdraw: 200,
  paymentNumbers: { bkash: "01XXXXXXXXX", nagad: "01XXXXXXXXX", rocket: "01XXXXXXXXX" },
  categories: ["whatsapp_status", "whatsapp_channel", "app_install", "social", "review", "other"],
  spinSegments: [
    { label: "১৳", value: 1, weight: 30, kind: "cash" },
    { label: "২৳", value: 2, weight: 22, kind: "cash" },
    { label: "৩৳", value: 3, weight: 14, kind: "cash" },
    { label: "৫৳", value: 5, weight: 8, kind: "cash" },
    { label: "৮৳", value: 8, weight: 3, kind: "cash" },
    { label: "২৫৳", value: 25, weight: 1, kind: "cash" },
    { label: "ধন্যবাদ", value: 0, weight: 20, kind: "none" },
    { label: "স্পেশাল", value: 0, weight: 2, kind: "special" },
  ],
  announcements: ["🎉 সিস্টেম সম্পূর্ণ এনক্রিপ্টেড | আপনার ব্যক্তিগত তথ্য সুরক্ষিত"],
};

export async function fetchSettings() {
  const db = getDb();
  try {
    const snap = await get(ref(db, "settings"));
    const data = snap.exists() ? snap.val() : {};
    return {
      ...DEFAULT_SETTINGS,
      ...data,
      paymentNumbers: { ...DEFAULT_SETTINGS.paymentNumbers, ...(data.paymentNumbers || {}) },
      spinSegments: Array.isArray(data.spinSegments) && data.spinSegments.length ? data.spinSegments : DEFAULT_SETTINGS.spinSegments,
      categories: Array.isArray(data.categories) && data.categories.length ? data.categories : DEFAULT_SETTINGS.categories,
      announcements: Array.isArray(data.announcements) ? data.announcements : DEFAULT_SETTINGS.announcements,
    };
  } catch (e) {
    console.warn("[settings] default ব্যবহার হচ্ছে:", e.message);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function fetchGlobalStats() {
  const db = getDb();
  try {
    const snap = await get(ref(db, "stats/global"));
    return snap.exists() ? snap.val() : { totalPayout: 0, totalUsers: 0, totalTasks: 0 };
  } catch { return { totalPayout: 0, totalUsers: 0, totalTasks: 0 }; }
}

/** ব্যবহারকারীর ওয়ালেট (rules: শুধু নিজেরটা পড়া যায়) */
export async function fetchWallet(uid) {
  const db = getDb();
  const snap = await get(ref(db, `wallets/${uid}`));
  return snap.exists() ? snap.val() : { available: 0, pending: 0, reserved: 0, totalEarned: 0, totalSpent: 0, totalWithdrawn: 0 };
}

export function watchWallet(uid, cb) {
  const db = getDb();
  return onValue(ref(db, `wallets/${uid}`), (snap) => {
    cb(snap.exists() ? snap.val() : { available: 0, pending: 0, reserved: 0, totalEarned: 0, totalSpent: 0, totalWithdrawn: 0 });
  }, (err) => toast(err.message, "error"));
}
