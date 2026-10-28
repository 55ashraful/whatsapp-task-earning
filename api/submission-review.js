/* ============================================================
   api/submission-review.js — Buyer (বা Admin) জমা রিভিউ
   decisions: approve | reject
   ------------------------------------------------------------
   নিরাপত্তা নিশ্চিত করে:
   • শুধু টাস্কের Buyer (বা Admin) রিভিউ করতে পারে
   • এক জমা একবারই রিভিউ হয় (atomic status transition pending→…)
   • পুরস্কার একবারই ক্রেডিট হয় (transaction + status guard)
   • Approve: wallet.reserved -= reward, task.reservedRemaining -= reward,
     worker.available += reward, প্রথমবার হলে রেফারেল বোনাস
   • Reject: Buyer-কে রিফান্ড
   ============================================================ */
const { getAdmin } = require("./_lib/admin.js");
const { ok, fail, methodGuard, readBody } = require("./_lib/http.js");
const { verifyUser, tx, notify, round2 } = require("./_lib/auth.js");

module.exports = async (req, res) => {
  if (!methodGuard(req, res)) return;
  try {
    const auth = await verifyUser(req);
    if (auth.error) return fail(res, auth.status, auth.error);
    const body = await readBody(req);
    const submissionId = String(body.submissionId || "");
    const taskId = String(body.taskId || "");
    const decision = body.decision;
    const reason = String(body.reason || "").trim();
    const isOverrideAdmin = body.overrideAdmin === true && auth.profile.role === "admin";

    if (!submissionId || !taskId) return fail(res, 400, "taskId ও submissionId প্রয়োজন");
    if (!["approve", "reject"].includes(decision)) return fail(res, 400, "decision অবশ্যই approve বা reject");
    if (decision === "reject" && reason.length < 4) return fail(res, 400, "প্রত্যাখ্যানের কারণ কমপক্ষে ৪ অক্ষরের দিন");

    const db = (await getAdmin()).database();
    const subSnap = await db.ref(`submissions/${taskId}/${submissionId}`).get();
    if (!subSnap.exists()) return fail(res, 404, "জমা পাওয়া যায়নি");
    const sub = subSnap.val();
    if (sub.status !== "pending") return fail(res, 409, "এই জমা আগেই রিভিউ হয়ে গেছে", "already_reviewed");

    const taskSnap = await db.ref(`tasks/${taskId}`).get();
    if (!taskSnap.exists()) return fail(res, 404, "সংশ্লিষ্ট টাস্ক পাওয়া যায়নি");
    const task = taskSnap.val();

    // অনুমতি: টাস্কের Buyer অথবা Admin
    if (!isOverrideAdmin && task.buyerId !== auth.uid) {
      return fail(res, 403, "শুধু এই টাস্কের Buyer রিভিউ করতে পারবেন");
    }
    if (task.status === "blocked") return fail(res, 400, "টাস্কটি Admin দ্বারা বন্ধ — রিভিউ সম্ভব নয়");

    const reward = round2(sub.reward || task.reward || 0);
    const buyerId = task.buyerId;
    const workerId = sub.workerId;
    const subPath = `submissions/${taskId}/${submissionId}`;
    const mirrorPath = `userSubmissions/${workerId}/${submissionId}`;

    if (decision === "approve") {
      /* ---- ATOMIC: pending→approved guard সহ ক্রেডিট ---- */
      const claim = await db.ref(`${subPath}/status`).transaction((st) => {
        return st === "pending" ? "approved" : undefined; // abort যদি অন্য কেউ আগে রিভিউ করে
      });
      if (!claim.committed) return fail(res, 409, "জমাটি সদ্য রিভিউ হয়ে গেছে — পেজ রিফ্রেশ করুন", "already_reviewed");

      try {
        // ১) Buyer ওয়ালেট: reserved থেকে বাদ
        await db.ref(`wallets/${buyerId}`).transaction((w) => ({
          ...(w || {}),
          reserved: round2(Math.max(0, (w.reserved || 0) - reward)),
          updatedAt: Date.now(),
        }));
        // ২) Task হিসাব
        await db.ref(`tasks/${taskId}`).transaction((t) => ({
          ...(t || {}),
          approvedCount: (t.approvedCount || 0) + 1,
          reservedRemaining: round2(Math.max(0, (t.reservedRemaining || 0) - reward)),
          status: (t.approvedCount || 0) + 1 >= t.slots ? "completed" : t.status,
        }));
        // ৩) Worker ওয়ালেট ক্রেডিট
        await db.ref(`wallets/${workerId}`).transaction((w) => ({
          ...(w || {}),
          available: round2((w.available || 0) + reward),
          totalEarned: round2((w.totalEarned || 0) + reward),
          updatedAt: Date.now(),
        }));
        // ৪) Worker হিস্টোরি mirror আপডেট
        await db.ref(`${mirrorPath}/status`).set("approved");
        await db.ref(`${mirrorPath}/reviewedAt`).set(Date.now());
        // ৫) লেনদেন + নোটিফিকেশন
        await tx(buyerId, -reward, "task_reward", `Worker পুরস্কার প্রদান: ${sub.taskTitle}`, submissionId, "success");
        await tx(workerId, reward, "task_reward", `টাস্ক অনুমোদিত: ${sub.taskTitle}`, submissionId, "success");
        await notify(workerId, "approved", "🎉 কাজ অনুমোদিত হয়েছে", `${sub.taskTitle} — ${reward.toFixed(2)}৳ ওয়ালেটে যোগ হয়েছে।`);
        await notify(buyerId, "task", "জমা অনুমোদন সম্পন্ন", `${sub.workerName}-এর জমা অনুমোদিত হয়েছে।`);
        // ৬) Assignment আপডেট
        await db.ref(`taskAssignments/${taskId}/${workerId}/status`).set("approved");
        // ৭) রেফারেল বোনাস (প্রথম অনুমোদিত টাস্কে একবারই — atomic guard)
        await payReferralBonus(db, workerId, submissionId, reward);
        // ৮) গ্লোবাল পেআউট স্ট্যাট
        await db.ref("stats/global/totalPayout").transaction((v) => round2((v || 0) + reward));
      } catch (e) {
        // ব্যর্থ হলে স্ট্যাটাস আবার pending — পুনরায় চেষ্টা করা যাবে
        await db.ref(`${subPath}/status`).set("pending");
        throw e;
      }
      return ok(res, { credited: reward });
    }

    /* ---- reject ---- */
    const claim = await db.ref(`${subPath}/status`).transaction((st) => {
      return st === "pending" ? "rejected" : undefined;
    });
    if (!claim.committed) return fail(res, 409, "জমাটি সদ্য রিভিউ হয়ে গেছে", "already_reviewed");

    try {
      // Buyer-কে রিফান্ড (reserved → available)
      await db.ref(`wallets/${buyerId}`).transaction((w) => ({
        ...(w || {}),
        reserved: round2(Math.max(0, (w.reserved || 0) - reward)),
        available: round2((w.available || 0) + reward),
        updatedAt: Date.now(),
      }));
      await db.ref(`tasks/${taskId}`).transaction((t) => ({
        ...(t || {}),
        rejectedCount: (t.rejectedCount || 0) + 1,
        reservedRemaining: round2(Math.max(0, (t.reservedRemaining || 0) - reward)),
      }));
      await db.ref(`${subPath}/rejectReason`).set(reason);
      await db.ref(`${subPath}/reviewedAt`).set(Date.now());
      await db.ref(`${mirrorPath}/status`).set("rejected");
      await db.ref(`${mirrorPath}/rejectReason`).set(reason);
      await db.ref(`${mirrorPath}/reviewedAt`).set(Date.now());
      await tx(buyerId, reward, "task_refund", `জমা প্রত্যাখ্যান রিফান্ড: ${sub.taskTitle}`, submissionId, "refunded");
      await notify(workerId, "rejected", "❌ জমা প্রত্যাখ্যাত", `${sub.taskTitle} — কারণ: ${reason}`);
      await db.ref(`taskAssignments/${taskId}/${workerId}/status`).set("rejected");
    } catch (e) {
      await db.ref(`${subPath}/status`).set("pending");
      throw e;
    }
    return ok(res, { refunded: reward });
  } catch (e) {
    console.error("[api/submission-review]", e);
    if (e.code === "ENV_MISSING") return fail(res, 500, e.message, "env_missing");
    fail(res, 500, "সার্ভার ত্রুটি — পরে আবার চেষ্টা করুন", "internal");
  }
};

/* রেফারেল বোনাস: বন্ধুর প্রথম অনুমোদিত টাস্কে একবার, referralRewards/{workerId}
   নোডটিই লক — দ্বিতীয়বার কখনো পেয়ে যাওয়া সম্ভব নয়। */
async function payReferralBonus(db, workerId, submissionId, reward) {
  const workerSnap = await db.ref(`users/${workerId}`).get();
  if (!workerSnap.exists()) return;
  const worker = workerSnap.val();
  const referrerUid = String(worker.referredBy || "");
  if (!referrerUid || referrerUid === workerId) return;

  const settingsSnap = await db.ref("settings").get();
  const settings = settingsSnap.exists() ? settingsSnap.val() : {};
  const flatBonus = round2(settings.referralBonusPerFriend ?? 20);
  const incomePercent = Number(settings.referIncomePercent ?? 5);

  // লক: প্রথমবারই
  const lock = await db.ref(`referralRewards/${workerId}`).transaction((cur) => {
    if (cur) return undefined; // already paid → abort
    return { submissionId, referrerUid, flatBonus, incomePercent, at: Date.now() };
  });
  if (!lock.committed) return;

  const snap2 = await db.ref(`users/${referrerUid}`).get();
  if (!snap2.exists() || snap2.val().status === "blocked") return;

  // ফ্ল্যাট বোনাস → রেফারারের রেফারেল ব্যালেন্স
  if (flatBonus > 0) {
    await db.ref(`referralRewardBalance/${referrerUid}`).transaction((rb) => ({
      ...(rb || {}),
      amount: round2(((rb && rb.amount) || 0) + flatBonus),
      updatedAt: Date.now(),
    }));
    await tx(referrerUid, flatBonus, "referral_bonus", `রেফারেল বোনাস: ${worker.displayName || "বন্ধু"}`, workerId, "success");
    await notify(referrerUid, "referral", "👥 রেফারেল বোনাস পেয়েছেন", `${worker.displayName || "আপনার বন্ধু"}-এর প্রথম টাস্ক অনুমোদিত — ${flatBonus.toFixed(2)}৳ রেফারেল ব্যালেন্সে যোগ হয়েছে।`);
  }
  // ৫% ইনকাম শেয়ার → রেফারেল ব্যালেন্স
  if (incomePercent > 0 && reward > 0) {
    const share = round2(reward * (incomePercent / 100));
    if (share > 0) {
      await db.ref(`referralRewardBalance/${referrerUid}`).transaction((rb) => ({
        ...(rb || {}),
        amount: round2(((rb && rb.amount) || 0) + share),
        updatedAt: Date.now(),
      }));
      await tx(referrerUid, share, "referral_income", `৫% ইনকাম শেয়ার: ${worker.displayName || "বন্ধু"}`, workerId, "success");
    }
  }
}
