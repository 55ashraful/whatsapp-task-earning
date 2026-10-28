/* ============================================================
   api/deposit.js — ডিপোজিট রিভিউ (শুধু Admin)
   body: { action:'review', requestId, decision:'approve'|'reject', adminNote }
   ------------------------------------------------------------
   অনুমোদনে:
   • স্ট্যাটাস pending→approved atomic guard (দ্বিগুণ অনুমোদন অসম্ভব)
   • একই TrxID আগে অনুমোদিত হয়ে থাকলে ব্লক (ডুপ্লিকেট প্রতিরোধ)
   • ইউজারের ব্যালেন্সে টাকা যোগ + লেনদেন + নোটিফিকেশন
   ============================================================ */
const { getAdmin } = require("./_lib/admin.js");
const { ok, fail, methodGuard, readBody } = require("./_lib/http.js");
const { requireAdmin, audit, tx, notify, round2 } = require("./_lib/auth.js");

module.exports = async (req, res) => {
  if (!methodGuard(req, res)) return;
  try {
    const adminAuth = await requireAdmin(req);
    if (adminAuth.error) return fail(res, adminAuth.status, adminAuth.error);
    const body = await readBody(req);
    if (body.action !== "review") return fail(res, 400, "অজানা action");
    const requestId = String(body.requestId || "");
    const userId = String(body.userId || "");
    const decision = body.decision;
    const adminNote = String(body.adminNote || "").trim();

    if (!requestId || !userId) return fail(res, 400, "requestId ও userId প্রয়োজন");
    if (!["approve", "reject"].includes(decision)) return fail(res, 400, "decision অবশ্যই approve বা reject");
    if (decision === "reject" && adminNote.length < 4) return fail(res, 400, "বাতিলের কারণ লিখুন");

    const db = (await getAdmin()).database();
    const reqSnap = await db.ref(`depositRequests/${userId}/${requestId}`).get();
    if (!reqSnap.exists()) return fail(res, 404, "রিকোয়েস্ট পাওয়া যায়নি");
    const dep = reqSnap.val();
    if (dep.status !== "pending") return fail(res, 409, "এই রিকোয়েস্ট আগেই প্রসেস হয়ে গেছে", "already_processed");

    const amount = round2(dep.amount);
    const reqPath = `depositRequests/${userId}/${requestId}`;

    if (decision === "approve") {
      // ডুপ্লিকেট TrxID যাচাই: অন্য কোনো approved রিকোয়েস্টে একই trxId আছে কি?
      const dupSnap = await db.ref("depositRequests").get();
      let dup = null;
      dupSnap.forEach((uSnap2) => {
        uSnap2.forEach((c) => {
          if (c.key !== requestId && c.val().status === "approved" && String(c.val().trxId || "") === String(dep.trxId || "")) dup = c.key;
        });
      });
      if (dup) {
        await db.ref(`${reqPath}/status`).set("rejected");
        await db.ref(`${reqPath}/adminNote`).set("ডুপ্লিকেট TrxID — এই ট্রানজেকশন আগে ব্যবহৃত হয়েছে");
        await audit("deposit_reject_duplicate", `${userId}/${requestId}`, `trxId=${dep.trxId} dup=${dup}`, adminAuth.uid, adminAuth.email);
        await notify(userId, "deposit", "ডিপোজিট প্রত্যাখ্যাত", "ডুপ্লিকেট TrxID — এই ট্রানজেকশন আগে ব্যবহৃত হয়েছে।");
        return fail(res, 409, "ডুপ্লিকেট TrxID — এই ট্রানজেকশন আগে অনুমোদিত হয়েছে", "duplicate_trx");
      }
      // atomic: pending→approved
      const claim = await db.ref(`${reqPath}/status`).transaction((st) => (st === "pending" ? "approved" : undefined));
      if (!claim.committed) return fail(res, 409, "রিকোয়েস্টটি সদ্য প্রসেস হয়েছে", "already_processed");
      try {
        await db.ref(`${reqPath}/reviewedAt`).set(Date.now());
        await db.ref(`wallets/${userId}`).transaction((w) => ({
          ...(w || {}),
          available: round2(((w && w.available) || 0) + amount),
          updatedAt: Date.now(),
        }));
        await tx(userId, amount, "deposit", `ডিপোজিট (${String(dep.method || "").toUpperCase()}) TrxID ${dep.trxId}`, requestId, "success");
        await notify(userId, "deposit", "✅ ডিপোজিট অনুমোদিত", `${amount.toFixed(2)}৳ ব্যালেন্সে যোগ হয়েছে।`);
        await audit("deposit_approve", `${userId}/${requestId}`, `amount=${amount}`, adminAuth.uid, adminAuth.email);
      } catch (e) {
        await db.ref(`${reqPath}/status`).set("pending");
        throw e;
      }
      return ok(res, { credited: amount });
    }

    /* reject */
    const claim = await db.ref(`${reqPath}/status`).transaction((st) => (st === "pending" ? "rejected" : undefined));
    if (!claim.committed) return fail(res, 409, "রিকোয়েস্টটি সদ্য প্রসেস হয়েছে", "already_processed");
    await db.ref(`${reqPath}/adminNote`).set(adminNote);
    await db.ref(`${reqPath}/reviewedAt`).set(Date.now());
    await notify(userId, "deposit", "❌ ডিপোজিট প্রত্যাখ্যাত", `কারণ: ${adminNote}`);
    await audit("deposit_reject", `${userId}/${requestId}`, `note=${adminNote}`, adminAuth.uid, adminAuth.email);
    return ok(res, { rejected: true });
  } catch (e) {
    console.error("[api/deposit]", e);
    if (e.code === "ENV_MISSING") return fail(res, 500, e.message, "env_missing");
    fail(res, 500, "সার্ভার ত্রুটি", "internal");
  }
};
