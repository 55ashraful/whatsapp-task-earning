/* ============================================================
   app.js тАФ ржЕрзНржпрж╛ржкрзЗрж░ ржорзВрж▓ ржПржирзНржЯрзНрж░рж┐ ржкржпрж╝рзЗржирзНржЯ
   - Firebase init (ржХржиржлрж┐ржЧ ржирж╛ ржерж╛ржХрж▓рзЗ ржмржирзНржзрзБрждрзНржмржкрзВрж░рзНржг рж╕рзЗржЯржЖржк ржЧрж╛ржЗржб ржжрзЗржЦрж╛ржпрж╝)
   - Auth state, route guard, shell (header/nav/sidebar) рж░рзЗржирзНржбрж╛рж░
   - ржирзЛржЯрж┐ржлрж┐ржХрзЗрж╢ржи unread badge, ржнрж╛рж╖рж╛ ржЯржЧрж▓, global error handling
   ============================================================ */
import { initFirebase, isFirebaseConfigured, getAuthInstance, getDb, CONFIG_ERROR_KEY } from "./firebase-config.js";
import { startRouter, handleRoute, navigate, parseHash, getCurrentRoute, setRouterHooks, ROUTES } from "./router.js";
import { $, $$, el, esc, toast, showLoading, confirmDialog } from "./utils.js";
import { applyI18n, t, setLang, getLang, LANGS } from "./i18n.js";
import { registerAuthListeners, setDbRef } from "./auth.js";
import { subscribeUnread } from "./notifications.js";
import { ensureUserProfile, watchUserProfile, getUserProfile, setProfileCache, clearProfileCache } from "./user.js";

let currentUser = null;
let profileUnsub = null;
let unreadUnsub = null;

export function getAuthUser() { return currentUser; }
export function getProfile() { return getUserProfile(); }

/* ---------------- Shell ---------------- */
function navIcon(name) {
  const map = { home: "home", tasks: "task", link: "link", earnings: "wallet", account: "user" };
  return `<img src="public/assets/icons/${map[name]}.svg" alt="" style="width:20px;height:20px;filter:invert(58%) sepia(14%) saturate(500%) hue-rotate(180deg)">`;
}
function navIconActive(name) {
  const map = { home: "home", tasks: "task", link: "link", earnings: "wallet", account: "user" };
  return `<img src="public/assets/icons/${map[name]}.svg" alt="" style="width:20px;height:20px">`;
}

function renderShell() {
  if ($("#app-shell")) return;
  const shell = el(`
    <div id="app-shell">
      <aside class="sidebar" id="sidebar"></aside>
      <div class="app-main">
        <header class="app-header" id="app-header">
          <a class="brand" href="#/home"><img src="public/assets/logo/logo.svg" alt="logo"><span data-i18n="appName">ржЯрж╛рж╕рзНржХ ржЖрж░рзНржирж┐ржВ</span></a>
          <div class="header-actions">
            <button class="icon-btn lang-btn" id="lang-toggle" title="ржнрж╛рж╖рж╛">EN</button>
            <a class="icon-btn" href="#/notifications" id="notif-bell" title="ржирзЛржЯрж┐ржлрж┐ржХрзЗрж╢ржи">ЁЯФФ<span class="badge-dot hidden" id="unread-badge">0</span></a>
            <button class="icon-btn" id="logout-btn" title="рж▓ржЧржЖржЙржЯ">тОЛ</button>
          </div>
        </header>
        <main id="page-outlet" class="page"></main>
        <a class="float-spin" href="#/spin"><img class="wheel-ico" src="public/assets/icons/spin.svg" alt=""><span>ржирж┐рж░рж╛ржкржж<br>рж╕рзНржкрж┐ржи</span></a>
        <nav class="bottom-nav" id="bottom-nav"></nav>
      </div>
    </div>`);
  document.body.appendChild(shell);
  renderBottomNav();
  renderSidebar();
  $("#lang-toggle").addEventListener("click", () => {
    setLang(getLang() === "bn" ? "en" : "bn");
    $("#lang-toggle").textContent = getLang() === "bn" ? "EN" : "ржмрж╛ржВ";
    renderBottomNav(); renderSidebar();
  });
  $("#logout-btn").addEventListener("click", doLogout);
}

function navItems() {
  return [
    { href: "#/home", key: "home", icon: "home" },
    { href: "#/tasks", key: "tasks", icon: "tasks" },
    { href: "#/whatsapp-link", key: "link", icon: "link", center: true },
    { href: "#/wallet", key: "earnings", icon: "earnings" },
    { href: "#/profile", key: "account", icon: "account" },
  ];
}

function renderBottomNav() {
  const nav = $("#bottom-nav");
  if (!nav) return;
  nav.innerHTML = navItems().map((it) => `
    <a href="${it.href}" data-nav="${it.key}" class="${it.center ? "nav-center" : ""}">
      <span class="nav-ico">${navIcon(it.icon)}</span>
      <span data-i18n="${it.key}">${t(it.key)}</span>
    </a>`).join("");
  applyI18n(nav);
  markActiveNav();
}

function renderSidebar() {
  const sb = $("#sidebar");
  if (!sb) return;
  const p = getUserProfile();
  sb.innerHTML = `
    <a class="brand" href="#/home"><img src="public/assets/logo/logo.svg" alt=""><span data-i18n="appName">${t("appName")}</span></a>
    <div class="sb-sep"></div>
    <a href="#/home" data-nav="home">${navIcon("home")}<span data-i18n="home">${t("home")}</span></a>
    <a href="#/tasks" data-nav="tasks">${navIcon("tasks")}<span data-i18n="tasks">${t("tasks")}</span></a>
    <a href="#/wallet" data-nav="earnings">${navIcon("earnings")}<span data-i18n="earnings">${t("earnings")}</span></a>
    <a href="#/spin"><img src="public/assets/icons/spin.svg" style="width:19px;height:19px" alt=""><span data-i18n="spin">${t("spin")}</span></a>
    <a href="#/referral">ЁЯОБ<span data-i18n="referral">${t("referral")}</span></a>
    <a href="#/notifications">ЁЯФФ<span data-i18n="notifications">${t("notifications")}</span></a>
    <a href="#/whatsapp-link">${navIcon("link")}<span data-i18n="link">${t("link")}</span></a>
    <div class="sb-sep"></div>
    ${p && p.role === "buyer" ? `<a href="#/create-task">тЮХ<span data-i18n="createTask">${t("createTask")}</span></a><a href="#/my-tasks">ЁЯУЛ<span data-i18n="myTasks">${t("myTasks")}</span></a>` : ""}
    <a href="#/profile">${navIcon("account")}<span data-i18n="profile">${t("profile")}</span></a>
    <a href="#/about">тД╣я╕П<span data-i18n="about">${t("about")}</span></a>
    <div class="sb-sep"></div><div class="sb-label">Legal</div>
    <a href="#/terms">ЁЯУДTerms</a><a href="#/privacy">ЁЯФТPrivacy</a><a href="#/faq">тЭУFAQ</a><a href="#/contact">ЁЯУЮContact</a>`;
  applyI18n(sb);
  markActiveNav();
}

function markActiveNav() {
  const { path } = parseHash();
  const keyFor = { "/home": "home", "/tasks": "tasks", "/task-details": "tasks", "/create-task": "tasks", "/my-tasks": "tasks",
    "/wallet": "earnings", "/transaction-history": "earnings", "/whatsapp-link": "link", "/profile": "account" };
  const key = keyFor[path];
  $$("#bottom-nav a, #sidebar a").forEach((a) => {
    const k = a.getAttribute("data-nav");
    a.classList.toggle("active", !!key && k === key);
  });
}

function updateHeaderForAuth() {
  const header = $("#app-header");
  if (!header) return;
  const loggedOut = !currentUser;
  $("#logout-btn").classList.toggle("hidden", loggedOut);
  $("#notif-bell").classList.toggle("hidden", loggedOut);
  const route = getCurrentRoute();
  const isAuthPage = route && route.route && route.route.auth === false && ["/login", "/register", "/reset"].includes(route.path);
  header.classList.toggle("ghost", !!isAuthPage);
  const brand = $(".brand", header);
  if (brand) brand.setAttribute("href", isAuthPage ? "#/login" : "#/home");
}

async function doLogout() {
  const ok = await confirmDialog(t("confirmLogout"), t("logout"));
  if (!ok) return;
  try {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");
    await signOut(getAuthInstance());
    navigate("/home", { replace: true });
    setTimeout(() => location.reload(), 60);
  } catch (e) {
    toast(friendlyError(e), "error");
  }
}

/* ---------------- Guards ---------------- */
function setupGuards() {
  setRouterHooks({
    beforeEach: (route, path) => {
      if (route.auth && !currentUser) return { redirect: "/login" };
      if (route.publicOnly && currentUser) return { redirect: "/home" };
      if (route.buyer) {
        const p = getUserProfile();
        if (p && p.role !== "buyer") return { redirect: "/home" };
      }
      const p = getUserProfile();
      if (currentUser && p && p.status === "blocked" && !["/login", "/profile", "/about", "/terms", "/privacy", "/contact"].includes(path)) {
        return { redirect: "/profile" };
      }
      return null;
    },
    notFound: (path) => {
      $("#page-outlet").innerHTML = `<div class="empty-state"><div class="ico">ЁЯзн</div><h4>ржкрзЗржЬржЯрж┐ ржЦрзБржБржЬрзЗ ржкрж╛ржУржпрж╝рж╛ ржпрж╛ржпрж╝ржирж┐</h4><p>${esc(path)} тАФ рж░рзБржЯржЯрж┐ ржирзЗржЗ</p><a class="btn btn-primary mt-3" style="width:auto" href="#/home">рж╣рзЛржорзЗ ржлрж┐рж░рзБржи</a></div>`;
    },
    onError: (e) => toast(friendlyError(e), "error"),
  });

  window.addEventListener("page:rendered", (ev) => {
    markActiveNav();
    updateHeaderForAuth();
    renderSidebar();
    const { path, query } = ev.detail || {};
    window.__WTE_UID__ = currentUser ? currentUser.uid : "";
    window.__WTE_DB__ = getDb();
    window.__WTE_AUTHUSER__ = currentUser;
    window.__WTE_PROFILE__ = getUserProfile();
    if (currentUser) bindFloatingSpinVisibility();
    dispatchPage(path, query);
  });
}

/* route тЖТ page binder mapping */
async function dispatchPage(path, query) {
  try {
    switch (path) {
      case "/login": { const m = await import("./auth.js"); m.bindLoginPage(); break; }
      case "/register": { const m = await import("./auth.js"); m.bindRegisterPage(); break; }
      case "/reset": { const m = await import("./auth.js"); m.bindResetPage(); break; }
      case "/home": { const m = await import("./home.js"); await m.bindHomePage(); break; }
      case "/tasks": { const m = await import("./tasks.js"); await m.bindTasksPage(); break; }
      case "/task-details": { const m = await import("./tasks.js"); await m.bindTaskDetailsPage(query); break; }
      case "/create-task": { const m = await import("./tasks.js"); await m.bindCreateTaskPage(); break; }
      case "/my-tasks": { const m = await import("./tasks.js"); await m.bindMyTasksPage(); break; }
      case "/submissions": { const m = await import("./submissions.js"); await m.bindSubmissionsPage(query); break; }
      case "/wallet": { const m = await import("./wallet.js"); m.bindWalletPage(); break; }
      case "/transaction-history": { const m = await import("./wallet.js"); m.bindTransactionPage(); break; }
      case "/referral": { const m = await import("./referrals.js"); await m.bindReferralPage(); break; }
      case "/spin": { const m = await import("./spin.js"); await m.bindSpinPage(); break; }
      case "/whatsapp-link": { const m = await import("./whatsapp.js"); m.bindWhatsappLinkPage(); break; }
      case "/profile": { const m = await import("./profile.js"); m.bindProfilePage(); break; }
      case "/notifications": { const m = await import("./notifications.js"); m.bindNotificationsPage(); break; }
      case "/faq": { bindFaq(); break; }
    }
  } catch (e) {
    console.error("[dispatch]", path, e);
    toast(String(e.message || e), "error");
  }
}

function bindFaq() {
  document.querySelectorAll(".faq-item").forEach((item) => {
    item.addEventListener("click", () => item.classList.toggle("open"));
  });
}

function bindFloatingSpinVisibility() {
  const fs = $(".float-spin");
  if (!fs) return;
  const route = getCurrentRoute();
  fs.classList.toggle("hidden", !!(route && route.path === "/spin"));
}

/* ---------------- Boot ---------------- */
function showFatalConfigGuide(err) {
  document.body.innerHTML = `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:18px;background:#f3f5f9;font-family:system-ui">
    <div style="background:#fff;border:1px solid #e4e9f2;border-radius:18px;max-width:560px;width:100%;padding:26px;box-shadow:0 10px 30px rgba(23,43,99,.12)">
      <div style="font-size:40px;text-align:center">тЪЩя╕П</div>
      <h2 style="text-align:center;margin:10px 0 6px">рж╕рзЗржЯржЖржк ржкрзНрж░ржпрж╝рзЛржЬржи</h2>
      <p style="color:#5b6b85;font-size:14px;text-align:center">${esc(err.message || String(err))}</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-top:14px;font-size:13px;color:#1e40af;line-height:1.8">
        <b>ржжрзНрж░рзБржд рж╕рзЗржЯржЖржк:</b><br>
        рзз. Firebase Console-ржП ржкрзНрж░ржЬрзЗржХрзНржЯ рждрзИрж░рж┐ ржХрж░рзБржи<br>
        рзи. Authentication тЖТ Email/Password + Google ржЪрж╛рж▓рзБ ржХрж░рзБржи<br>
        рзй. Realtime Database рждрзИрж░рж┐ ржХрж░рзБржи<br>
        рзк. <code>src/js/firebase-config.js</code> ржлрж╛ржЗрж▓рзЗ ржЖржкржирж╛рж░ config ржмрж╕рж╛ржи<br>
        рзл. <code>firebase/database.rules.json</code> ржирж┐ржпрж╝ржо ржкрзНрж░ржХрж╛рж╢ ржХрж░рзБржи<br>
        рзм. Vercel Environment Variables рж╕рзЗржЯ ржХрж░рзБржи (README.md ржжрзЗржЦрзБржи)
      </div>
      <button onclick="location.reload()" style="margin-top:16px;width:100%;padding:12px;border-radius:12px;background:#2456e6;color:#fff;font-weight:700;font-size:15px">ржЖржмрж╛рж░ ржЪрзЗрж╖рзНржЯрж╛ ржХрж░рзБржи</button>
    </div>
  </div>`;
}

function bindGlobalErrors() {
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[unhandledrejection]", e.reason);
  });
  window.addEventListener("error", (e) => {
    console.error("[window error]", e.message);
  });
}

async function boot() {
  bindGlobalErrors();
  try {
    await initFirebase();
    const auth = getAuthInstance();
    const db = getDb();
    setDbRef(db);
    const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");
    const { ref, onValue } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js");

    renderShell();
    applyI18n(document);
    $("#lang-toggle").textContent = getLang() === "bn" ? "EN" : "ржмрж╛ржВ";
    setupGuards();
    registerAuthListeners({ onAuthSuccess, onAuthReset });

    onAuthStateChanged(auth, async (user) => {
      try {
        if (profileUnsub) { profileUnsub(); profileUnsub = null; }
        if (unreadUnsub) { unreadUnsub(); unreadUnsub = null; }
        if (user) {
          currentUser = user;
          await ensureUserProfile(user); // рж░рзЗржЬрж┐рж╕рзНржЯрзНрж░рзЗрж╢ржирзЗрж░ ржкрж░ ржкрзНрж░рзЛржлрж╛ржЗрж▓ ржирж┐рж╢рзНржЪрж┐ржд ржХрж░рж╛ (Google first-login)
          profileUnsub = watchUserProfile(user.uid, (profile) => {
            setProfileCache(profile);
            renderSidebar();
          });
          unreadUnsub = subscribeUnread(db, user.uid, (count) => {
            const b = $("#unread-badge");
            if (!b) return;
            b.textContent = count > 99 ? "99+" : String(count);
            b.classList.toggle("hidden", count <= 0);
          });
        } else {
          currentUser = null;
          clearProfileCache();
        }
        updateHeaderForAuth();
        handleRoute();
      } catch (e) {
        console.error("[auth state]", e);
        toast(friendlyError(e), "error");
      }
    });

    startRouter();
  } catch (e) {
    console.error("[boot]", e);
    if (e.code === CONFIG_ERROR_KEY || e.code === "firebase_init_failed") showFatalConfigGuide(e);
    else showFatalConfigGuide(e);
  }
}

function onAuthSuccess() { /* route guard ржирж┐ржЬрзЗржЗ /home-ржП ржирж┐ржпрж╝рзЗ ржпрж╛ржпрж╝ */ }
function onAuthReset() { /* handled inside auth.js */ }

boot();
