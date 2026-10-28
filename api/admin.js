/* ============================================================
   api/admin.js — Admin অ্যাকশন (শুধু users/{uid}.role === 'admin')
   actions:
     bootstrap      — ADMIN_EMAILS env-এ থাকা ইমেইলকে প্রথমবার Admin করা
     blockUser / unblockUser
     setUserRole    — pending → worker (ইতিমধ্যে admin নয় এমন রোলে)
     closeTask / reopenTask
     resolveReport
     updateSettings — settings নোড আপডেট (হোয়াইটলিস্ট করা ফিল্ড)
     broadcast      — সব ইউজারের নোটিফিকেশনে ঘোষণা (≤৫০০ ইউজার)
   প্রতিটি অ্যাকশন adminAuditLogs-এ রেকর্ড হয়।
   ============================================================ */
const { getAdmin } = require("./_lib/admin.js");
const { ok, fail, methodGuard, readBody } = require("./_lib/http.js");
const { requireAdmin, verifyUser, audit, notify, round2 } = require("./_lib/auth.js");

module.exports = async (req, res) => {
  if (!methodGuard(req, res)) return;
  try {
    const body = await readBody(req);
    const action = String(body.action || "");

    /* bootstrap — লগইন করা কিন্তু admin নয় এমন ইউজারের জন্য বিশেষ পথ */
    if (action === "bootstrap") return await bootstrap(req, res);

    const adminAuth = await requireAdmin(req);
    if (adminAuth.error) return fail(res, adminAuth.status, adminAuth.error);
    const db = (await getAdmin()).database();

    switch (action) {
      case "blockUser": {
        const targetUid = String(body.targetUid || "");
        if (!targetUid || targetUid === adminAuth.uid) return fail(res, 400, "targetUid প্রয়োজন (নিজেকে ব্লক করা যাবে না)");
        const target = await db.ref(`users/${targetUid}`).get();
        if (!target.exists()) return fail(res, 404, "ইউজার পাওয়া যায়নি");
        if (target.val().role === "admin") return fail(res, 403, "Admin অ্যাকাউন্ট ব্লক করা যাবে না");
        await db.ref(`users/${targetUid}/status`).set("blocked");
        await notify(targetUid, "account", "⛔ অ্যাকাউন্ট ব্লক হয়েছে", "আপনার অ্যাকাউন্ট নীতিমালা লঙ্ঘনের কারণে ব্লক করা হয়েছে। আপিল করতে সাপোর্টে যোগাযোগ করুন।");
        await audit("block_user", targetUid, "", adminAuth.uid, adminAuth.email);
        return ok(res, { done: true });
      }
      case "unblockUser": {
        const targetUid = String(body.targetUid || "");
        if (!targetUid) return fail(res, 400, "targetUid প্রয়োজন");
        await db.ref(`users/${targetUid}/status`).set("active");
        await notify(targetUid, "account", "✅ অ্যাকাউন্ট পুনরায় সক্রিয়", "আপনার অ্যাকাউন্ট আনব্লক করা হয়েছে।");
        await audit("unblock_user", targetUid, "", adminAuth.uid, adminAuth.email);
        return ok(res, { done: true });
      }
      case "setUserRole": {
        const targetUid = String(body.targetUid || "");
        const role = String(body.role || "");
        if (!targetUid || !["worker", "buyer"].includes(role)) return fail(res, 400, "targetUid ও role (worker/buyer) প্রয়োজন");
        await db.ref(`users/${targetUid}/role`).set(role);
        await audit("set_user_role", targetUid, `role=${role}`, adminAuth.uid, adminAuth.email);
        return ok(res, { done: true });
      }
      case "closeTask": {
        const taskId = String(body.taskId || "");
        const taskSnap = await db.ref(`tasks/${taskId}`).get();
        if (!taskSnap.exists()) return fail(res, 404, "টাস্ক পাওয়া যায়নি");
        const task = taskSnap.val();
        if (["completed", "cancelled", "blocked"].includes(task.status)) return fail(res, 400, "টাস্ক ইতিমধ্যে বন্ধ");
        const refund = round2(task.reservedRemaining || 0);
        await db.ref(`tasks/${taskId}`).update({ status: "blocked", reservedRemaining: 0, closedBy: adminAuth.uid, closedAt: Date.now() });
        if (refund > 0 && task.buyerId) {
          await db.ref(`wallets/${task.buyerId}`).transaction((w) => ({
            ...(w || {}),
            available: round2(((w && w.available) || 0) + refund),
            reserved: round2(Math.max(0, ((w && w.reserved) || 0) - refund)),
            updatedAt: Date.now(),
          }));
          await notify(task.buyerId, "task", "টাস্ক Admin দ্বারা বন্ধ", `"${task.title}" বন্ধ করা হয়েছে; ${refund.toFixed(2)}৳ রিফান্ড ব্যালেন্সে যোগ হয়েছে।`);
        }
        await audit("close_task", taskId, `refund=${refund}`, adminAuth.uid, adminAuth.email);
        return ok(res, { done: true, refunded: refund });
      }
      case "reopenTask": {
        const taskId = String(body.taskId || "");
        await db.ref(`tasks/${taskId}/status`).set("active");
        await db.ref(`tasks/${taskId}/closedBy`).remove();
        await audit("reopen_task", taskId, "", adminAuth.uid, adminAuth.email);
        return ok(res, { done: true });
      }
      case "resolveReport": {
        const reportId = String(body.reportId || "");
        if (!reportId) return fail(res, 400, "reportId প্রয়োজন");
        await db.ref(`reports/${reportId}`).update({ status: "resolved", adminNote: String(body.adminNote || "").slice(0, 300), resolvedAt: Date.now(), resolvedBy: adminAuth.uid });
        await audit("resolve_report", reportId, "", adminAuth.uid, adminAuth.email);
        return ok(res, { done: true });
      }
      case "updateSettings": {
        const s = body.settings || {};
        const clean = {};
        // হোয়াইটলিস্ট — শুধু অনুমোদিত ফিল্ডই লেখা হয়
        const nums = ["referralBonusPerFriend", "referIncomePercent", "referTransferMin", "spinFreeDaily", "spinCooldownMinutes", "paidSpinCost", "minDeposit", "minWithdraw"];
        nums.forEach((k) => { if (s[k] !== undefined && Number.isFinite(Number(s[k]))) clean[k] = round2(s[k]) === Number(s[k]) ? Number(s[k]) : round2(s[k]); });
        if (typeof s.supportWhatsapp === "string") clean.supportWhatsapp = s.supportWhatsapp.replace(/[^0-9+]/g, "").slice(0, 16);
        if (s.paymentNumbers && typeof s.paymentNumbers === "object") {
          clean.paymentNumbers = {
            bkash: String(s.paymentNumbers.bkash || "").replace(/[^0-9]/g, "").slice(0, 14),
            nagad: String(s.paymentNumbers.nagad || "").replace(/[^0-9]/g, "").slice(0, 14),
            rocket: String(s.paymentNumbers.rocket || "").replace(/[^0-9]/g, "").slice(0, 14),
          };
        }
        if (Array.isArray(s.categories)) clean.categories = s.categories.map((c) => String(c).replace(/[^a-z_]/gi, "").slice(0, 24)).filter(Boolean).slice(0, 20);
        if (Array.isArray(s.announcements)) clean.announcements = s.announcements.map((a) => String(a).slice(0, 200)).filter(Boolean).slice(0, 10);
        await db.ref("settings").update(clean);
        await audit("update_settings", "settings", JSON.stringify(clean).slice(0, 500), adminAuth.uid, adminAuth.email);
        return ok(res, { done: true });
      }
      case "broadcast": {
        const message = String(body.message || "").trim().slice(0, 300);
        if (message.length < 5) return fail(res, 400, "বার্তা কমপক্ষে ৫ অক্ষরের দিন");
        const usersSnap = await db.ref("users").limitToFirst(500).get();
        let count = 0;
        const pushAll = [];
        usersSnap.forEach((c) => {
          pushAll.push(db.ref(`notifications/${c.key}`).push({
            type: "system", title: "📢 সিস্টেম ঘোষণা", body: message, read: false, createdAt: Date.now(),
          }));
          count++;
        });
        await Promise.all(pushAll);
        await audit("broadcast", "all_users", `users=${count}`, adminAuth.uid, adminAuth.email);
        return ok(res, { sentTo: count });
      }
      default:
        return fail(res, 400, "অজানা action", "unknown_action");
    }
  } catch (e) {
    console.error("[api/admin]", e);
    if (e.code === "ENV_MISSING") return fail(res, 500, e.message, "env_missing");
    fail(res, 500, "সার্ভার ত্রুটি", "internal");
  }
};

/* প্রথম Admin নিয়োগ — শুধু ADMIN_EMAILS env-এ থাকা ইমেইল, এবং
   সিস্টেমে ইতিমধ্যে অন্য কোনো admin না থাকলে (সেফটি গার্ড) */
async function bootstrap(req, res) {
  const auth = await verifyUser(req);
  if (auth.error) return fail(res, auth.status, auth.error);
  const allowed = String(process.env.ADMIN_EMAILS || "")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return fail(res, 500, "ADMIN_EMAILS কনফিগার করা হয়নি — Vercel Environment Variables দেখুন", "admin_emails_missing");
  const email = String(auth.email || "").toLowerCase();
  if (!email || !allowed.includes(email)) {
    return fail(res, 403, "এই ইমেইলটি ADMIN_EMAILS তালিকায় নেই — অনুমতি নেই", "not_in_admin_emails");
  }
  const db = (await getAdmin()).database();
  // গার্ড: ইতিমধ্যে কোনো admin আছে কি? (প্রথমবার bootstrap এর পর এই পথ আর কাজ করবে না)
  const usersSnap = await db.ref("users").limitToFirst(500).get();
  let existingAdmin = null;
  usersSnap.forEach((c) => { if (c.val().role === "admin" && c.key !== auth.uid) existingAdmin = c.key; });
  if (existingAdmin) return fail(res, 403, "সিস্টেমে ইতিমধ্যে Admin আছে — Firebase Console বা বিদ্যমান Admin-এর মাধ্যমে রোল দিন", "admin_exists");
  await db.ref(`users/${auth.uid}/role`).set("admin");
  await db.ref(`users/${auth.uid}/status`).set("active");
  await audit("bootstrap_admin", auth.uid, `email=${email}`, auth.uid, auth.email);
  return ok(res, { promoted: true });
}
