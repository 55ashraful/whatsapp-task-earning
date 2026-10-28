/* ============================================================
   api/upload-image.js — নিরাপদ ImgBB আপলোড প্রক্সি
   ------------------------------------------------------------
   • IMGBB_API_KEY শুধু সার্ভারে থাকে (client কখনো দেখে না)
   • লগইন করা ইউজারের বৈধ ID token ছাড়া আপলোড অসম্ভব
   • সাইজ/টাইপ যাচাই + প্রতি ইউজারে রেট-লিমিট (স্মৃতি ভিত্তিক)
   ============================================================ */
const { ok, fail, methodGuard, readBody } = require("./_lib/http.js");
const { verifyUser } = require("./_lib/auth.js");

/* সহজ ইন-মেমরি রেট লিমিট: প্রতি ইউজারে প্রতি ৫ মিনিটে সর্বোচ্চ ১০টি */
const rateMap = new Map();
function rateLimited(uid) {
  const now = Date.now();
  const win = rateMap.get(uid) || [];
  const fresh = win.filter((t) => now - t < 5 * 60000);
  fresh.push(now);
  rateMap.set(uid, fresh);
  if (rateMap.size > 5000) rateMap.clear();
  return fresh.length > 10;
}

module.exports = async (req, res) => {
  if (!methodGuard(req, res)) return;
  try {
    const auth = await verifyUser(req);
    if (auth.error) return fail(res, auth.status, auth.error);
    if (rateLimited(auth.uid)) return fail(res, 429, "খুব দ্রুত অনেক আপলোড — কিছুক্ষণ পরে চেষ্টা করুন", "rate_limited");

    const body = await readBody(req);
    const b64 = String(body.imageBase64 || "").replace(/^data:[^;]+;base64,/, "");
    if (!b64) return fail(res, 400, "ছবির ডেটা পাওয়া যায়নি");
    const sizeBytes = Math.floor(b64.length * 3 / 4);
    if (sizeBytes < 1024) return fail(res, 400, "ছবি খুব ছোট");
    if (sizeBytes > 8 * 1024 * 1024) return fail(res, 400, "ছবির সাইজ ৮MB-এর কম হতে হবে");

    const key = process.env.IMGBB_API_KEY;
    if (!key) return fail(res, 500, "IMGBB_API_KEY কনফিগার করা হয়নি — Vercel Environment Variables দেখুন (.env.example)", "imgbb_key_missing");

    // Node 18+: গ্লোবাল fetch উপলব্ধ
    const params = new URLSearchParams();
    params.append("image", b64);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let resp;
    try {
      resp = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
        method: "POST",
        body: params,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data || !data.success || !data.data || !data.data.url) {
      console.error("[imgbb] failed:", resp.status, data && data.error);
      return fail(res, 502, "ImgBB আপলোড ব্যর্থ হয়েছে — পরে আবার চেষ্টা করুন বা সরাসরি URL ব্যবহার করুন", "imgbb_failed");
    }
    return ok(res, { url: data.data.url, deleteUrl: data.data.delete_url || "", thumb: (data.data.thumb && data.data.thumb.url) || data.data.url });
  } catch (e) {
    if (e.code === "body_too_large") return fail(res, 413, e.message);
    console.error("[api/upload-image]", e);
    if (e.name === "AbortError") return fail(res, 504, "আপলোড টাইমআউট — নেটওয়ার্ক পরীক্ষা করুন", "timeout");
    fail(res, 500, "সার্ভার ত্রুটি", "internal");
  }
};
