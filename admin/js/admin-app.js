/* ============================================================
   admin-app.js — Admin SPA বুটস্ট্র্যাপ, অথ গার্ড, হ্যাশ রাউটার
   ============================================================ */
import { initFirebase, getAuthInstance, getDb } from "../../src/js/firebase-config.js";
import { ref, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { esc, toast } from "../../src/js/utils.js";
import { bindAdminLogin, tryBootstrapAdmin } from "./admin-auth.js";

const ROOT = document.getElementById("admin-root");
let adminUser = null;
let adminProfile = null;
export function getAdminUser() { return adminUser; }
export function getAdminProfile() { return adminProfile; }

const TABS = [
  { path: "/dashboard", label: "📊 ড্যাশবোর্ড" },
  { path: "/users", label: "👥 ইউজার" },
  { path: "/tasks", label: "📋 টাস্ক" },
  { path: "/submissions", label: "📝 সাবমিশন", badge: "submissions" },
  { path: "/deposits", label: "🏦 ডিপোজিট", badge: "deposits" },
  { path: "/withdrawals", label: "🏧 উত্তোলন", badge: "withdrawals" },
  { path: "/reports", label: "🚩 রিপোর্ট", badge: "reports" },
  { path: "/settings", label: "⚙️ সেটিংস" },
  { path: "/audit", label: "🧾 অডিট লগ" },
];

function renderShell() {
  ROOT.innerHTML = `
  <div class="a-shell">
    <header class="a-topbar">
      <a class="a-brand" href="#/dashboard"><img src="../public/assets/logo/logo.svg" alt=""><span>Admin Panel</span></a>
      <div class="a-user">
        <span class="a-avatar">${esc((adminProfile.displayName || "A").charAt(0).toUpperCase())}</span>
        <span>${esc(adminProfile.email || "")}</span>
        <button class="a-logout" id="a-logout">লগআউট</button>
      </div>
    </header>
    <nav class="a-tabs" id="a-tabs">
      ${TABS.map((t) => `<a href="#${t.path}" data-tab="${t.path}">${t.label}<span class="cnt hidden" data-badge="${t.badge || ""}"></span></a>`).join("")}
    </nav>
    <main class="a-main" id="a-main"></main>
  </div>
  <div class="a-toast-wrap" id="a-toast-wrap"></div>`;
  ROOT.querySelector("#a-logout").addEventListener("click", async () => {
    await signOut(getAuthInstance());
    location.reload();
  });
  window.addEventListener("hashchange", route);
}

/* pending badge counts (rules: admin সব পড়তে পারে) */
async function refreshBadges() {
  try {
    const [subs, deps, wds, reps] = await Promise.all([
      countNested("submissions", "pending"),
      countNested("depositRequests", "pending"),
      countNested("withdrawalRequests", "pending"),
      countFlat("reports", "open"),
    ]);
    setBadge("submissions", subs); setBadge("deposits", deps);
    setBadge("withdrawals", wds); setBadge("reports", reps);
  } catch {}
}
async function countNested(node, status) {
  const db = getDb();
  const snap = await get(ref(db, node));
  let n = 0;
  snap.forEach((lvl) => lvl.forEach((c) => { if (c.child("status").val() === status) n++; }));
  return n;
}
async function countFlat(node, status) {
  const db = getDb();
  const snap = await get(query(ref(db, node), orderByChild("status"), equalTo(status)));
  return snap.exists() ? snap.size : 0;
}
function setBadge(key, n) {
  const el = ROOT.querySelector(`[data-badge="${key}"]`);
  if (!el) return;
  el.textContent = n > 0 ? String(n) : "";
  el.classList.toggle("hidden", !(n > 0));
}

async function route() {
  const { path, query } = parseHash();
  ROOT.querySelectorAll("[data-tab]").forEach((a) => a.classList.toggle("on", a.getAttribute("data-tab") === path));
  const main = ROOT.querySelector("#a-main");
  main.innerHTML = '<div class="a-guard"><span class="a-spinner"></span><span>লোড হচ্ছে...</span></div>';
  try {
    switch (path) {
      case "/dashboard": { const m = await import("./admin-dashboard.js"); await m.render(main); break; }
      case "/users": { const m = await import("./admin-users.js"); await m.render(main, query); break; }
      case "/tasks": { const m = await import("./admin-tasks.js"); await m.render(main, query); break; }
      case "/submissions": { const m = await import("./admin-submissions.js"); await m.render(main, query); break; }
      case "/deposits": { const m = await import("./admin-deposits.js"); await m.render(main); break; }
      case "/withdrawals": { const m = await import("./admin-withdrawals.js"); await m.render(main); break; }
      case "/reports": { const m = await import("./admin-reports.js"); await m.render(main); break; }
      case "/settings": { const m = await import("./admin-settings.js"); await m.render(main); break; }
      case "/audit": { const m = await import("./admin-reports.js"); await m.renderAudit(main); break; }
      default: main.innerHTML = '<div class="a-empty">অজানা রুট</div>';
    }
    refreshBadges();
  } catch (e) {
    console.error("[admin route]", e);
    main.innerHTML = `<div class="a-empty">⚠️ ${esc(e.message || String(e))}</div>`;
  }
}
function parseHash() {
  const raw = (location.hash || "#/dashboard").replace(/^#/, "");
  const [path, qs] = raw.split("?");
  const query = {};
  (qs || "").split("&").forEach((p) => { const [k, v] = p.split("="); if (k) query[k] = decodeURIComponent(v || ""); });
  return { path: path || "/dashboard", query };
}

/* ---------- Boot ---------- */
(async function boot() {
  try {
    await initFirebase();
    const auth = getAuthInstance();
    const db = getDb();
    onAuthStateChanged(auth, async (user) => {
      if (!user) { renderLogin(); return; }
      try {
        const snap = await get(ref(db, `users/${user.uid}`));
        const prof = snap.exists() ? snap.val() : null;
        if (prof && prof.role === "admin" && prof.status !== "blocked") {
          adminUser = user; adminProfile = prof;
          window.__WTE_UID__ = user.uid;
          window.__WTE_DB__ = db;
          if (!ROOT.querySelector(".a-shell")) renderShell();
          route();
        } else {
          renderNoAccess(prof);
        }
      } catch (e) {
        renderError(e);
      }
    });
  } catch (e) {
    ROOT.innerHTML = `<div class="a-guard"><div class="big">⚙️</div><b>Firebase কনফিগার করা হয়নি</b><span>${esc(e.message || String(e))}</span></div>`;
  }
})();

function renderLogin() {
  ROOT.innerHTML = `<div class="a-login-wrap"><div class="a-login-card">
    <div class="a-logo"><img src="../public/assets/logo/logo.svg" alt=""><h1>Admin Panel</h1><p class="sub">শুধুমাত্র অনুমোদিত Admin-দের জন্য</p></div>
    <div class="a-error hidden" id="a-login-error"></div>
    <form id="a-form-login">
      <div class="a-form-row"><div><label class="a-label">ইমেইল</label><input class="a-input" type="email" id="a-email" autocomplete="email"></div></div>
      <div class="a-form-row"><div><label class="a-label">পাসওয়ার্ড</label><input class="a-input" type="password" id="a-password" autocomplete="current-password"></div></div>
      <button class="a-btn primary" style="width:100%;justify-content:center;padding:12px" type="submit">লগইন</button>
    </form>
    <div style="text-align:center;margin:12px 0 6px;color:#64748b;font-size:12px">— অথবা —</div>
    <button class="a-btn ghost" style="width:100%;justify-content:center" id="a-google">Google দিয়ে লগইন</button>
    <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px">
      <div style="font-size:12px;color:#64748b;margin-bottom:8px">প্রথমবার Admin সেটআপ? (Vercel-এ ADMIN_EMAILS-এ আপনার ইমেইল থাকতে হবে)</div>
      <button class="a-btn primary" style="width:100%;justify-content:center" id="a-bootstrap">🛡️ আমাকে Admin করুন (Bootstrap)</button>
    </div>
  </div></div>`;
  bindAdminLogin();
  ROOT.querySelector("#a-bootstrap").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = "যাচাই হচ্ছে...";
    const res = await tryBootstrapAdmin();
    btn.disabled = false; btn.innerHTML = old;
    if (!res.ok) toast(res.error, "error", 5000);
    else toast("Admin হিসেবে নিয়োগ সম্পন্ন — পেজ রিফ্রেশ হচ্ছে", "success");
  });
}

function renderNoAccess(prof) {
  ROOT.innerHTML = `<div class="a-guard">
    <div class="big">⛔</div>
    <h2 style="color:#0f172a">অ্যাক্সেস অনুমোদিত নয়</h2>
    <p>${esc(prof && prof.email ? prof.email : "")} — এই অ্যাকাউন্টের role: <b>${esc((prof && prof.role) || "none")}</b></p>
    <p style="max-width:420px;font-size:13px">Admin হতে: ১) Vercel Environment Variable <code>ADMIN_EMAILS</code>-এ এই ইমেইল যোগ করে রিডিপ্লয় করুন, তারপর লগইন পেজের "Bootstrap" বাটন চাপুন; অথবা ২) Firebase Console → Realtime Database → <code>users/{UID}/role</code> = <code>"admin"</code> সেট করুন।</p>
    <button class="a-btn ghost" onclick="location.reload()">রিফ্রেশ</button>
  </div>`;
}

function renderError(e) {
  ROOT.innerHTML = `<div class="a-guard"><div class="big">⚠️</div><p>${esc(e.message || String(e))}</p><button class="a-btn ghost" onclick="location.reload()">রিফ্রেশ</button></div>`;
}
