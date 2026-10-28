/* ============================================================
   utils.js — DOM helpers, toast, modal, format, validators,
              serverless API caller (ID token সহ)
   ============================================================ */
import { getAuthInstance } from "./firebase-config.js";

/* ---------- DOM ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function el(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

/* ---------- Loading / Toast / Modal ---------- */
export function showLoading(container, text = "লোড হচ্ছে...") {
  if (!container) return;
  container.innerHTML = `
    <div class="loading-block">
      <span class="spinner dark"></span>
      <span>${esc(text)}</span>
    </div>`;
}

export function toast(message, type = "info", ms = 3200) {
  let wrap = $("#toast-wrap");
  if (!wrap) {
    wrap = el('<div id="toast-wrap"></div>');
    document.body.appendChild(wrap);
  }
  const icons = { success: "✓", error: "✕", warn: "⚠", info: "ℹ" };
  const node = el(`<div class="toast ${esc(type)}"><span>${icons[type] || "ℹ"}</span><span>${esc(message)}</span></div>`);
  wrap.appendChild(node);
  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transition = "opacity .3s";
    setTimeout(() => node.remove(), 320);
  }, ms);
}

export function openModal(innerHtml, opts = {}) {
  const backdrop = el(`<div class="modal-backdrop"><div class="modal ${opts.cls || ""}">${innerHtml}</div></div>`);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop && !opts.locked) closeModal(backdrop); });
  document.body.appendChild(backdrop);
  document.body.style.overflow = "hidden";
  if (!opts.locked) {
    const c = $(".modal-close", backdrop);
    if (c) c.addEventListener("click", () => closeModal(backdrop));
  }
  return backdrop;
}
export function closeModal(node) {
  const bd = typeof node === "string" ? $(node) : node || $(".modal-backdrop");
  if (bd) { bd.remove(); document.body.style.overflow = ""; }
}

export function confirmDialog(message, okText = "নিশ্চিত করুন") {
  return new Promise((resolve) => {
    const bd = openModal(`
      <div class="modal-head"><h3>অনুমোদন প্রয়োজন</h3><button class="modal-close">✕</button></div>
      <p style="font-size:14px;color:var(--text-2)">${esc(message)}</p>
      <div class="row mt-3">
        <button class="btn btn-ghost" data-act="no">বাতিল</button>
        <button class="btn btn-primary" data-act="yes">${esc(okText)}</button>
      </div>`, {});
    $("[data-act='yes']", bd).addEventListener("click", () => { closeModal(bd); resolve(true); });
    $("[data-act='no']", bd).addEventListener("click", () => { closeModal(bd); resolve(false); });
    $(".modal-close", bd).addEventListener("click", () => resolve(false));
  });
}

/** বাটনে loading state লাগায়; ফেরত দেয় restore ফাংশন */
export function btnLoading(btn) {
  if (!btn) return () => {};
  const old = btn.innerHTML;
  btn.classList.add("loading");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  return () => { btn.classList.remove("loading"); btn.disabled = false; btn.innerHTML = old; };
}

/* ---------- Format ---------- */
export function money(n) {
  const v = Number(n || 0);
  return "৳" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtTime(ts) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  if (isNaN(d)) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
export function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "এইমাত্র";
  if (s < 3600) return Math.floor(s / 60) + " মিনিট আগে";
  if (s < 86400) return Math.floor(s / 3600) + " ঘণ্টা আগে";
  if (s < 604800) return Math.floor(s / 86400) + " দিন আগে";
  return fmtDate(ts);
}
export function uid8() { return Math.random().toString(36).slice(2, 10); }

export function genReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/* ---------- Validators ---------- */
export const v = {
  email: (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim()),
  phone: (s) => /^01[3-9]\d{8}$/.test(String(s || "").replace(/[\s-]/g, "").replace(/^\+?880/, "0")),
  trxId: (s) => /^[A-Za-z0-9]{6,20}$/.test(String(s || "").trim()),
  url: (s) => { try { const u = new URL(String(s)); return u.protocol === "http" || u.protocol === "https"; } catch { return false; } },
  name: (s) => String(s || "").trim().length >= 3 && String(s).trim().length <= 40,
  amount: (s, min) => Number(s) > 0 && (!min || Number(s) >= min),
  code: (s) => /^[A-Z0-9]{4,10}$/.test(String(s || "").trim().toUpperCase()),
};

/** প্রথম invalid ঘরে error দেখায়; সব ঠিক থাকলে true */
export function markInvalid(input, msg) {
  if (!input) return false;
  input.classList.add("err");
  input.addEventListener("input", () => input.classList.remove("err"), { once: true });
  if (msg) toast(msg, "error");
  return false;
}

/* ---------- Serverless API caller ----------
   সব টাকা-সংক্রান্ত অপারেশন Vercel serverless function-এ যায়,
   বর্তমান ব্যবহারকারীর Firebase ID token সহ — server সেটি verify করে। */
export async function apiCall(endpoint, payload = {}) {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) { const e = new Error("লগইন প্রয়োজন"); e.code = "auth/unauthenticated"; throw e; }
  const idToken = await user.getIdToken(/* forceRefresh */ false);
  let res;
  try {
    res = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    const e = new Error("সার্ভারে পৌঁছানো যাচ্ছে না — ইন্টারনেট সংযোগ পরীক্ষা করুন");
    e.code = "network/timeout";
    throw e;
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const e = new Error(data.error || `সার্ভার ত্রুটি (${res.status})`);
    e.code = data.code || "api/error";
    e.status = res.status;
    throw e;
  }
  return data;
}

/* ---------- Image upload (via server-side ImgBB proxy) ---------- */
export async function uploadImage(file) {
  if (!file) throw new Error("কোনো ফাইল নির্বাচন করা হয়নি");
  const okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!okTypes.includes(file.type)) throw new Error("শুধু JPG, PNG, WebP বা GIF ছবি দেওয়া যাবে");
  if (file.size > 8 * 1024 * 1024) throw new Error("ছবির সাইজ ৮MB-এর কম হতে হবে");
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) throw new Error("লগইন প্রয়োজন");
  const idToken = await user.getIdToken(false);
  const b64 = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("ফাইল পড়া যায়নি"));
    r.readAsDataURL(file);
  });
  const res = await fetch("/api/upload-image", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ imageBase64: b64 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || "ছবি আপলোড ব্যর্থ হয়েছে");
  return data.url;
}

/* ---------- Error mapping (user-friendly বাংলা) ---------- */
export function friendlyError(e) {
  const code = e && e.code ? String(e.code) : "";
  const map = {
    "auth/invalid-credential": "ইমেইল বা পাসওয়ার্ড সঠিক নয়",
    "auth/wrong-password": "পাসওয়ার্ড সঠিক নয়",
    "auth/user-not-found": "এই ইমেইলে কোনো অ্যাকাউন্ট নেই",
    "auth/email-already-in-use": "এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে",
    "auth/weak-password": "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে",
    "auth/invalid-email": "ইমেইল ফরম্যাট সঠিক নয়",
    "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে — কিছুক্ষণ পরে চেষ্টা করুন",
    "auth/network-request-failed": "নেটওয়ার্ক সমস্যা — সংযোগ পরীক্ষা করুন",
    "auth/popup-closed-by-user": "Google উইন্ডো বন্ধ হয়ে গেছে",
    "auth/popup-blocked": "ব্রাউজার পপআপ ব্লক করেছে — অনুমতি দিন",
    "auth/unauthenticated": "আগে লগইন করুন",
    "firebase_config_missing": "Firebase কনফিগার করা হয়নি — README.md অনুসরণ করুন",
    "firebase_init_failed": "Firebase লোড ব্যর্থ — ইন্টারনেট দেখুন",
    "network/timeout": "সার্ভারে পৌঁছানো যায়নি — আবার চেষ্টা করুন",
    "permission-denied": "অনুমতি নেই — অ্যাকশনটি করা যায় না",
  };
  return (e && (map[code] || e.message)) || "অপ্রত্যাশিত সমস্যা হয়েছে — আবার চেষ্টা করুন";
}

/* ---------- Misc ---------- */
export function maskPhone(p) {
  const s = String(p || "");
  if (s.length < 7) return s;
  return s.slice(0, 3) + "****" + s.slice(-4);
}
export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch (e) { /* noop */ }
  ta.remove();
  return Promise.resolve();
}
export function debounce(fn, ms = 300) {
  let h; return (...args) => { clearTimeout(h); h = setTimeout(() => fn(...args), ms); };
}
