/* ============================================================
   api/withdrawal.js — উত্তোলন রিকোয়েস্ট (ইউজার) + রিভিউ (Admin)
   body: { action:'request', method, accountNumber, amount }
         { action:'review', requestId, decision, adminNote }  (Admin)
   ------------------------------------------------------------
   request: min-limit + available balance যাচাই server-এ (rules ছাড়াও)
   review(approve): atomic pending→approved; ব্যালেন্স আবার যাচাই করে
                    টাকা কাটে — রেস কন্ডিশনে দ্বিগুণ কাটা অসম্ভব
   ============================================================ */
const { getAdmin } = require("./_lib/admin.js");
const { ok, fail, methodGuard, readBody } = require("./_lib/http.js");
const { verifyUser, requireAdmin, audit, tx, notify, round2 } = require("./_lib/auth.js");

module.exports = async (req, res) => {
  if (!methodGuard(req, res)) return;
  try {
    const body = await readBody(req);
    if (body.action === "request") {
      const auth = await verifyUser(req);
      if (auth.error) return fail(res, auth.status, auth.error);
      return await requestWithdrawal(res, auth, body);
    }
    if (body.action === "review") {
      const adminAuth = await requireAdmin(req);
      if (adminAuth.error) return fail(res, adminAuth.status, adminAuth.error);
      return await reviewWithdrawal(res, adminAuth, body);
    }
    return fail(res, 400, "অজানা action", "unknown_action");
  } catch (e) {
    console.error("[api/withdrawal]", e);
    if (e.code === "ENV_MISSING") return fail(res, 500, e.message, "env_missing");
    fail(res, 500, "সার্ভার ত্রুটি", "internal");
  }
};

async function requestWithdrawal(res, auth, body) {
  const db = (await getAdmin()).database();
  const uid = auth.uid;
  const method = String(body.method || "").toLowerCase();
  const accountNumber = String(body.accountNumber || "").replace(/[\s-]/g, "");
  const amount = round2(body.amount);

  if (!["bkash", "nagad", "rocket"].includes(method)) return fail(res, 400, "পেমেন্ট মাধ্যম নির্বাচন করুন");
  if (!/^01[3-9]\d{8}$/.test(accountNumber.replace(/^\+?880/, "0"))) return fail(res, 400, "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন");
  if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, "সঠিক পরিমাণ দিন");

  const settingsSnap = await db.ref("settings/minWithdraw").get();
  const minWithdraw = round2(settingsSnap.exists() ? settingsSnap.val() : 200);
  if (amount < minWithdraw) return fail(res, 400, `সর্বনিম্ন উত্তোলন ৳${minWithdraw.toFixed(2)}`, "below_minimum");

  const walletSnap = await db.ref(`wallets/${uid}`).get();
  const available = round2(walletSnap.exists() ? walletSnap.val().available : 0);
  if (amount > available) return fail(res, 400, `উত্তোলনযোগ্য ব্যালেন্স মাত্র ৳${available.toFixed(2)}`, "insufficient_balance");

  // রেস প্রতিরোধ: এক ইউজারের একাধিক pending উত্তোলন থাকলে নতুন নেওয়া যাবে না
  const pendingSnap = await db.ref("withdrawalRequests").orderByChild("userId").equalTo(uid).get();
  let pendingCount = 0;
  pendingSnap.forEach((c) => { if (c.val().status === "pending") pendingCount++; });
  if (pendingCount >= 2) return fail(res, 429, "আপনার আগের উত্তোলন রিকোয়েস্টগুলো এখনও পেন্ডিং — অপেক্ষা করুন", "too_many_pending");

  const ref = db.ref("withdrawalRequests").push();
  await ref.set({
    userId: uid, userEmail: auth.email || "",
    method, accountNumber,
    amount, currency: "BDT", status: "pending",
    createdAt: Date.now(), reviewedAt: 0, adminNote: "",
  });
  await notify(uid, "withdraw", "উত্তোলন রিকোয়েস্ট জমা হয়েছে", `${amount.toFixed(2)}৳ → ${accountNumber} (${method.toUpperCase()})। Admin ২৪-৪৮ ঘণ্টায় প্রসেস করবেন।`);
  return ok(res, { requestId: ref.key });
}

async function reviewWithdrawal(res, adminAuth, body) {
  const db = (await getAdmin()).database();
  const requestId = String(body.requestId || "");
  const userId = String(body.userId || "");
  const decision = body.decision;
  const adminNote = String(body.adminNote || "").trim();
  if (!requestId || !userId) return fail(res, 400, "requestId ও userId প্রয়োজন");
  if (!["approve", "reject"].includes(decision)) return fail(res, 400, "decision অবশ্যই approve বা reject");
  if (decision === "reject" && adminNote.length < 4) return fail(res, 400, "বাতিলের কারণ লিখুন");

  const reqPath = `withdrawalRequests/${userId}/${requestId}`;
  const reqSnap = await db.ref(reqPath).get();
  if (!reqSnap.exists()) return fail(res, 404, "রিকোয়েস্ট পাওয়া যায়নি");
  const wreq = reqSnap.val();
  if (wreq.status !== "pending") return fail(res, 409, "এই রিকোয়েস্ট আগেই প্রসেস হয়ে গেছে", "already_processed");
  const amount = round2(wreq.amount);

  if (decision === "approve") {
    // atomic: ব্যালেন্স যাচাই করে কাটা (দুই অনুমোদনের রেসেও নিরাপদ)
    const deduct = await db.ref(`wallets/${userId}`).transaction((w) => {
      const available = round2((w && w.available) || 0);
      if (available < amount) return undefined; // abort — ব্যালেন্স নেই
      return {
        ...(w || {}),
        available: round2(available - amount),
        totalWithdrawn: round2(((w && w.totalWithdrawn) || 0) + amount),
        updatedAt: Date.now(),
      };
    });
    if (!deduct.committed) {
      await db.ref(`${reqPath}/status`).set("rejected");
      await db.ref(`${reqPath}/adminNote`).set("ব্যালেন্স অপর্যাপ্ত — রিকোয়েস্ট বাতিল");
      return fail(res, 400, "ইউজারের ব্যালেন্স অপর্যাপ্ত — রিকোয়েস্ট বাতিল করা হয়েছে", "insufficient_balance");
    }
    const claim = await db.ref(`${reqPath}/status`).transaction((st) => (st === "pending" ? "approved" : undefined));
    if (!claim.committed) {
      // অন্য Admin আগেই অনুমোদন করেছে — কাটা টাকা ফেরত
      await db.ref(`wallets/${userId}`).transaction((w) => ({ ...(w || {}), available: round2((w.available || 0) + amount), totalWithdrawn: round2(Math.max(0, (w.totalWithdrawn || 0) - amount)), updatedAt: Date.now() }));
      return fail(res, 409, "রিকোয়েস্টটি সদ্য প্রসেস হয়েছে", "already_processed");
    }
    await db.ref(`${reqPath}/reviewedAt`).set(Date.now());
    await tx(userId, -amount, "withdrawal", `উত্তোলন (${String(wreq.method || "").toUpperCase()}) → ${wreq.accountNumber}`, requestId, "success");
    await notify(userId, "withdraw", "✅ উত্তোলন সম্পন্ন", `${amount.toFixed(2)}৳ পাঠানো হয়েছে ${wreq.accountNumber} নম্বরে।`);
    await audit("withdrawal_approve", `${userId}/${requestId}`, `amount=${amount}`, adminAuth.uid, adminAuth.email);
    return ok(res, { paid: amount });
  }

  /* reject */
  const claim = await db.ref(`${reqPath}/status`).transaction((st) => (st === "pending" ? "rejected" : undefined));
  if (!claim.committed) return fail(res, 409, "রিকোয়েস্টটি সদ্য প্রসেস হয়েছে", "already_processed");
  await db.ref(`${reqPath}/adminNote`).set(adminNote);
  await db.ref(`${reqPath}/reviewedAt`).set(Date.now());
  await notify(userId, "withdraw", "❌ উত্তোলন প্রত্যাখ্যাত", `কারণ: ${adminNote}`);
  await audit("withdrawal_reject", `${userId}/${requestId}`, `note=${adminNote}`, adminAuth.uid, adminAuth.email);
  return ok(res, { rejected: true });
}
