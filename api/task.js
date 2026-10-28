/* ============================================================
   api/task.js — Buyer টাস্ক তৈরি/বাতিল + রেফারেল ট্রান্সফার
   actions: create | cancel | transferReferral
   ------------------------------------------------------------
   নিরাপত্তা: বাজেট reserve ও রিফান্ড সব ATOMIC transaction-এ।
   Client কখনো সরাসরি ওয়ালেট লিখতে পারে না (RTDB rules)।
   ============================================================ */
const { getAdmin } = require("./_lib/admin.js");
const { ok, fail, methodGuard, readBody } = require("./_lib/http.js");
const { verifyUser, audit, tx, notify, round2 } = require("./_lib/auth.js");

module.exports = async (req, res) => {
  if (!methodGuard(req, res)) return;
  try {
    const auth = await verifyUser(req);
    if (auth.error) return fail(res, auth.status, auth.error);
    const body = await readBody(req);
    const action = body.action;

    if (action === "create") return await createTask(req, res, auth, body);
    if (action === "cancel") return await cancelTask(req, res, auth, body);
    if (action === "transferReferral") return await transferReferral(req, res, auth, body);
    return fail(res, 400, "অজানা action", "unknown_action");
  } catch (e) {
    console.error("[api/task]", e);
    if (e.code === "ENV_MISSING") return fail(res, 500, e.message, "env_missing");
    fail(res, 500, "সার্ভার ত্রুটি — পরে আবার চেষ্টা করুন", "internal");
  }
};

/* ---------------- টাস্ক তৈরি ---------------- */
async function createTask(req, res, auth, body) {
  const admin = await getAdmin();
  const db = admin.database();
  const uid = auth.uid;
  const profile = auth.profile;

  if (profile.role !== "buyer") return fail(res, 403, "টাস্ক তৈরি করতে Buyer অ্যাকাউন্ট প্রয়োজন");

  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const rules = String(body.rules || "").trim();
  const imageUrl = String(body.imageUrl || "").trim();
  const category = String(body.category || "other").trim();
  const proofType = ["text", "image", "both"].includes(body.proofType) ? body.proofType : "both";
  const reward = round2(body.reward);
  const slots = Math.floor(Number(body.slots));
  const deadlineHours = [12, 24, 48, 72].includes(Number(body.deadlineHours)) ? Number(body.deadlineHours) : 24;

  if (title.length < 8 || title.length > 90) return fail(res, 400, "টাস্কের শিরোনাম ৮-৯০ অক্ষরের হতে হবে");
  if (description.length < 20 || description.length > 4000) return fail(res, 400, "বিবরণ কমপক্ষে ২০ অক্ষরের হতে হবে");
  if (!Number.isFinite(reward) || reward < 1 || reward > 10000) return fail(res, 400, "পুরস্কার ৳১ - ৳১০,০০০ এর মধ্যে হতে হবে");
  if (!Number.isInteger(slots) || slots < 1 || slots > 1000) return fail(res, 400, "স্লট ১-১০০০ এর মধ্যে হতে হবে");
  if (imageUrl && !/^https?:\/\/.+/i.test(imageUrl)) return fail(res, 400, "ছবির URL সঠিক নয়");

  const budget = round2(reward * slots);
  const taskRef = db.ref("tasks").push();
  const taskId = taskRef.key;
  const walletRef = db.ref(`wallets/${uid}`);

  // ATOMIC: ওয়ালেট থেকে বাজেট reserve + টাস্ক তৈরি একসাথে
  const result = await db.ref("wallets/" + uid).transaction((wallet) => {
    const w = wallet || {};
    const available = round2(w.available || 0);
    if (available < budget) return undefined; // abort — পর্যাপ্ত ব্যালেন্স নেই
    return {
      ...w,
      available: round2(available - budget),
      reserved: round2((w.reserved || 0) + budget),
      totalSpent: round2((w.totalSpent || 0) + budget),
      updatedAt: Date.now(),
    };
  });
  if (!result.committed) return fail(res, 400, `পর্যাপ্ত ব্যালেন্স নেই — প্রয়োজন ৳${budget.toFixed(2)}`, "insufficient_balance");

  try {
    await taskRef.set({
      id: taskId,
      buyerId: uid,
      buyerName: profile.displayName || "Buyer",
      title, description, rules, imageUrl, category, proofType,
      reward, slots, filled: 0, approvedCount: 0, rejectedCount: 0,
      reservedRemaining: budget, budget,
      deadlineHours, status: "active",
      createdAt: Date.now(),
    });
    await db.ref("stats/global/totalTasks").transaction((v) => (v || 0) + 1);
    await tx(uid, -budget, "task_reserve", `টাস্ক বাজেট reserve: ${title}`, taskId, "reserved");
    await notify(uid, "task", "টাস্ক প্রকাশিত হয়েছে", `${title} — মোট ${budget.toFixed(2)}৳ reserve হয়েছে।`);
    return ok(res, { taskId, budget });
  } catch (e) {
    // টাস্ক তৈরি ব্যর্থ হলে reserve ফেরত
    await walletRef.transaction((w) => ({
      ...(w || {}),
      available: round2((w.available || 0) + budget),
      reserved: round2(Math.max(0, (w.reserved || 0) - budget)),
      totalSpent: round2(Math.max(0, (w.totalSpent || 0) - budget)),
      updatedAt: Date.now(),
    }));
    throw e;
  }
}

/* ---------------- টাস্ক বাতিল (রিফান্ড সহ) ---------------- */
async function cancelTask(req, res, auth, body) {
  const admin = await getAdmin();
  const db = admin.database();
  const uid = auth.uid;
  const taskId = String(body.taskId || "");
  if (!taskId) return fail(res, 400, "taskId প্রয়োজন");

  const taskSnap = await db.ref(`tasks/${taskId}`).get();
  if (!taskSnap.exists()) return fail(res, 404, "টাস্ক পাওয়া যায়নি");
  const task = taskSnap.val();
  if (task.buyerId !== uid) return fail(res, 403, "এই টাস্ক আপনার নয়");
  if (!["active", "full"].includes(task.status)) return fail(res, 400, "এই টাস্ক বাতিল করা যাবে না");

  const refund = round2(task.reservedRemaining || 0);
  const updates = {};
  updates[`tasks/${taskId}/status`] = "cancelled";
  updates[`tasks/${taskId}/reservedRemaining`] = 0;
  updates[`tasks/${taskId}/cancelledAt`] = Date.now();
  await db.ref().update(updates);

  if (refund > 0) {
    await db.ref(`wallets/${uid}`).transaction((w) => ({
      ...(w || {}),
      available: round2((w.available || 0) + refund),
      reserved: round2(Math.max(0, (w.reserved || 0) - refund)),
      updatedAt: Date.now(),
    }));
    await tx(uid, refund, "task_refund", `টাস্ক বাতিল রিফান্ড: ${task.title}`, taskId, "refunded");
  }

  // পেন্ডিং জমাগুলো প্রত্যাখ্যান + নোটিফিকেশন
  const subsSnap = await db.ref(`submissions/${taskId}`).get();
  const pendings = [];
  subsSnap.forEach((c) => { if (c.val().status === "pending") pendings.push({ id: c.key, workerId: c.val().workerId }); });
  for (const p of pendings) {
    await db.ref(`submissions/${taskId}/${p.id}/status`).set("rejected");
    await db.ref(`submissions/${taskId}/${p.id}/rejectReason`).set("টাস্কটি Buyer বাতিল করেছে");
    await db.ref(`userSubmissions/${p.workerId}/${p.id}/status`).set("rejected");
    await db.ref(`userSubmissions/${p.workerId}/${p.id}/rejectReason`).set("টাস্কটি Buyer বাতিল করেছে");
    await notify(p.workerId, "rejected", "জমা প্রত্যাখ্যাত", `টাস্কটি বাতিল হওয়ায় জমা বাতিল হয়েছে: ${task.title}`);
  }

  await notify(uid, "task", "টাস্ক বাতিল হয়েছে", `${task.title} — ${refund.toFixed(2)}৳ রিফান্ড ব্যালেন্সে যোগ হয়েছে।`);
  return ok(res, { refunded: refund });
}

/* ---------------- রেফারেল ব্যালেন্স → মূল ব্যালেন্স ---------------- */
async function transferReferral(req, res, auth, body) {
  const admin = await getAdmin();
  const db = admin.database();
  const uid = auth.uid;

  const settingsSnap = await db.ref("settings/referTransferMin").get();
  const minTransfer = round2(settingsSnap.exists() ? settingsSnap.val() : 50);

  const result = await db.ref(`referralRewardBalance/${uid}`).transaction((rb) => {
    const amount = round2((rb && rb.amount) || 0);
    if (amount < minTransfer) return undefined; // abort
    return { ...(rb || {}), amount: 0, lastTransferAt: Date.now(), lastTransferAmount: amount };
  });
  if (!result.committed) return fail(res, 400, `ট্রান্সফারের জন্য কমপক্ষে ৳${minTransfer.toFixed(2)} রেফারেল ব্যালেন্স প্রয়োজন`, "insufficient_referral_balance");

  const moved = round2(result.snapshot.val().lastTransferAmount || 0);
  await db.ref(`wallets/${uid}`).transaction((w) => ({
    ...(w || {}),
    available: round2((w.available || 0) + moved),
    updatedAt: Date.now(),
  }));
  await tx(uid, moved, "referral_income", "রেফারেল ব্যালেন্স ট্রান্সফার", "", "success");
  await notify(uid, "referral", "রেফারেল ট্রান্সফার সম্পন্ন", `${moved.toFixed(2)}৳ মূল ব্যালেন্সে যোগ হয়েছে।`);
  return ok(res, { transferred: moved });
}
