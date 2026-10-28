/* ============================================================
   api/spin.js — সার্ভার-অথরিটেটিভ লাকি হুইল
   body: { type: 'free' | 'paid' }
   ------------------------------------------------------------
   • সেগমেন্ট ওজন server-এর settings.spinSegments থেকে বাছে
   • ফ্রি স্পিন: দৈনিক সীমা + কুলডাউন (spinState/{uid}) atomic যাচাই
   • পেইড স্পিন: ব্যালেন্স থেকে টাকা কাটা atomic transaction-এ
   • ফলাফল spinHistory-তে লেখা হয় — client শুধু অ্যানিমেশন দেখায়
   ============================================================ */
const { getAdmin } = require("./_lib/admin.js");
const { ok, fail, methodGuard, readBody } = require("./_lib/http.js");
const { verifyUser, tx, notify, round2 } = require("./_lib/auth.js");

const DEFAULT_SEGMENTS = [
  { label: "১৳", value: 1, weight: 30, kind: "cash" },
  { label: "২৳", value: 2, weight: 22, kind: "cash" },
  { label: "৩৳", value: 3, weight: 14, kind: "cash" },
  { label: "৫৳", value: 5, weight: 8, kind: "cash" },
  { label: "৮৳", value: 8, weight: 3, kind: "cash" },
  { label: "২৫৳", value: 25, weight: 1, kind: "cash" },
  { label: "ধন্যবাদ", value: 0, weight: 20, kind: "none" },
  { label: "স্পেশাল", value: 0, weight: 2, kind: "special" },
];

module.exports = async (req, res) => {
  if (!methodGuard(req, res)) return;
  try {
    const auth = await verifyUser(req);
    if (auth.error) return fail(res, auth.status, auth.error);
    const body = await readBody(req);
    const type = body.type === "paid" ? "paid" : "free";
    const uid = auth.uid;
    const admin = await getAdmin();
    const db = admin.database();

    // সেটিংস লোড
    const settingsSnap = await db.ref("settings").get();
    const settings = settingsSnap.exists() ? settingsSnap.val() : {};
    const segments = (Array.isArray(settings.spinSegments) && settings.spinSegments.length ? settings.spinSegments : DEFAULT_SEGMENTS)
      .map((s) => ({ label: String(s.label || ""), value: Number(s.value) || 0, weight: Math.max(0, Number(s.weight) || 0), kind: ["cash", "none", "special"].includes(s.kind) ? s.kind : "none" }))
      .filter((s) => s.weight > 0);
    if (!segments.length) return fail(res, 500, "স্পিন কনফিগারেশন ভুল — Admin Settings পরীক্ষা করুন");
    const freeDaily = Math.max(0, Number(settings.spinFreeDaily ?? 3));
    const cooldownMin = Math.max(0, Number(settings.spinCooldownMinutes ?? 120));
    const paidCost = round2(settings.paidSpinCost ?? 20);

    /* ---- পেইড স্পিন: আগে ব্যালেন্স কাটা (atomic) ---- */
    if (type === "paid") {
      const deduct = await db.ref(`wallets/${uid}`).transaction((w) => {
        const available = round2((w && w.available) || 0);
        if (available < paidCost) return undefined; // abort
        return {
          ...(w || {}),
          available: round2(available - paidCost),
          totalSpent: round2(((w && w.totalSpent) || 0) + paidCost),
          updatedAt: Date.now(),
        };
      });
      if (!deduct.committed) return fail(res, 400, `পেইড স্পিনের জন্য ${paidCost.toFixed(2)}৳ প্রয়োজন`, "insufficient_balance");
      await tx(uid, -paidCost, "paid_spin", "পেইড স্পিন খরচ", "", "success");
    }

    /* ---- ফ্রি স্পিন: দৈনিক সীমা + কুলডাউন (atomic state আপডেট) ---- */
    let freeAllowed = false;
    if (type === "free") {
      const now = Date.now();
      const today = new Date(now).toISOString().slice(0, 10);
      const claim = await db.ref(`spinState/${uid}`).transaction((state) => {
        const s = state || {};
        const daily = s.daily && s.daily.date === today ? s.daily : { date: today, count: 0 };
        if (daily.count >= freeDaily) return undefined; // abort — দৈনিক সীমা শেষ
        if (s.lastFreeAt && cooldownMin > 0 && now - s.lastFreeAt < cooldownMin * 60000) return undefined; // abort — কুলডাউন
        daily.count += 1;
        return { ...s, daily, lastFreeAt: now };
      });
      if (!claim.committed) {
        // কারণ নির্ণয়
        const stSnap = await db.ref(`spinState/${uid}`).get();
        const st = stSnap.exists() ? stSnap.val() : {};
        const used = st.daily && st.daily.date === today ? st.daily.count : 0;
        if (used >= freeDaily) return fail(res, 429, "আজকের ফ্রি স্পিন শেষ — আগামীকাল আবার আসুন বা Paid Spin নিন", "daily_limit");
        const waitMs = st.lastFreeAt ? cooldownMin * 60000 - (now - st.lastFreeAt) : 0;
        const mins = Math.max(1, Math.ceil(waitMs / 60000));
        return fail(res, 429, `কুলডাউন চলছে — আরও ${mins} মিনিট অপেক্ষা করুন`, "cooldown");
      }
      freeAllowed = true;
    }

    /* ---- সেগমেন্ট নির্বাচন (weighted) — সম্পূর্ণ server-side ---- */
    const totalWeight = segments.reduce((a, s) => a + s.weight, 0);
    let roll = Math.random() * totalWeight;
    let index = 0;
    for (let i = 0; i < segments.length; i++) {
      roll -= segments[i].weight;
      if (roll <= 0) { index = i; break; }
    }
    const seg = segments[index];
    const value = round2(seg.value);

    /* ---- পুরস্কার ক্রেডিট + রেকর্ড ---- */
    if (seg.kind === "cash" && value > 0) {
      await db.ref(`wallets/${uid}`).transaction((w) => ({
        ...(w || {}),
        available: round2(((w && w.available) || 0) + value),
        totalEarned: round2(((w && w.totalEarned) || 0) + value),
        updatedAt: Date.now(),
      }));
      await tx(uid, value, "spin_reward", `স্পিন পুরস্কার: ${seg.label}`, type, "success");
    }
    const histRef = db.ref(`spinHistory/${uid}`).push();
    await histRef.set({ type, label: seg.label, kind: seg.kind, value, at: Date.now() });
    // লাইভ উইনার (cash জিতলেই) — masked number
    if (seg.kind === "cash" && value > 0) {
      const phone = String((auth.profile.whatsapp || {}).number || auth.profile.email || "").replace(/^\+?880/, "0");
      const masked = phone.length >= 7 ? phone.slice(0, 3) + "****" + phone.slice(-4) : "ব্যবহারকারী";
      await db.ref("liveWins").push({ maskedPhone: masked, label: seg.label, value, at: Date.now() });
    }
    // স্পেশাল → Admin-দের জানানো হয় নোটিফিকেশনে (ম্যানুয়াল প্রদানের জন্য)
    if (seg.kind === "special") {
      await notify(uid, "spin", "🎁 স্পেশাল পুরস্কার জিতেছেন!", "অভিনন্দন! সাপোর্ট টিম শীঘ্রই যোগাযোগ করবে। রেকর্ড আইডি: " + histRef.key);
    }

    return ok(res, {
      segmentIndex: index,
      segments: segments.length,
      segment: seg,
      type,
    });
  } catch (e) {
    console.error("[api/spin]", e);
    if (e.code === "ENV_MISSING") return fail(res, 500, e.message, "env_missing");
    fail(res, 500, "সার্ভার ত্রুটি — পরে আবার চেষ্টা করুন", "internal");
  }
};
