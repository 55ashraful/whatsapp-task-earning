/* ============================================================
   router.js — hash-based SPA router (রেফারেন্স সাইটের মতো #/route)
   - প্রতিটি route → src/pages/*.html fragment (fetch + cache)
   - guards: auth প্রয়োজন এমন route-এ লগইন ছাড়া ঢোকা যায় না
   - Direct URL refresh করলেও কাজ করে (hash সার্ভারে যায় না)
   ============================================================ */
import { $, showLoading, toast, friendlyError } from "./utils.js";

/** route → { page: fragment path, auth: লগইন দরকার?, title: bn } */
export const ROUTES = {
  "/login":               { page: "login",               auth: false, publicOnly: true },
  "/register":            { page: "register",            auth: false, publicOnly: true },
  "/reset":               { page: "reset",               auth: false, publicOnly: true },
  "/home":                { page: "home",                auth: true },
  "/tasks":               { page: "tasks",               auth: true },
  "/task-details":        { page: "task-details",        auth: true },
  "/create-task":         { page: "create-task",         auth: true, buyer: true },
  "/my-tasks":            { page: "my-tasks",            auth: true, buyer: true },
  "/submissions":         { page: "submissions",         auth: true },
  "/wallet":              { page: "wallet",              auth: true },
  "/transaction-history": { page: "transaction-history", auth: true },
  "/referral":            { page: "referral",            auth: true },
  "/spin":                { page: "spin",                auth: true },
  "/whatsapp-link":       { page: "whatsapp-link",       auth: true },
  "/profile":             { page: "profile",             auth: true },
  "/notifications":       { page: "notifications",       auth: true },
  "/about":               { page: "about",               auth: false },
  "/terms":               { page: "terms",               auth: false },
  "/privacy":             { page: "privacy",             auth: false },
  "/task-rules":          { page: "task-rules",          auth: false },
  "/faq":                 { page: "faq",                 auth: false },
  "/contact":             { page: "contact",             auth: false },
};

const fragmentCache = new Map();
let routerHooks = { beforeEach: null, notFound: null, onError: null };
let currentRoute = null;

export function setRouterHooks(hooks) { routerHooks = { ...routerHooks, ...hooks }; }
export function getCurrentRoute() { return currentRoute; }

export function parseHash() {
  let h = location.hash || "#/home";
  if (h === "#" || h === "#/") h = "#/home";
  const raw = h.replace(/^#/, "");
  const [path, queryStr] = raw.split("?");
  const query = {};
  if (queryStr) {
    queryStr.split("&").forEach((pair) => {
      const [k, val] = pair.split("=");
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(val || "");
    });
  }
  return { path: path.startsWith("/") ? path : "/" + path, query };
}

export function navigate(path, { replace = false } = {}) {
  const target = "#" + (path.startsWith("/") ? path : "/" + path);
  if (location.hash === target) { handleRoute(); return; }
  if (replace) location.replace(target);
  else location.hash = target;
}

async function loadFragment(name) {
  if (fragmentCache.has(name)) return fragmentCache.get(name);
  const res = await fetch(`src/pages/${name}.html`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`পেজ খুঁজে পাওয়া যায়নি: ${name} (${res.status})`);
  const html = await res.text();
  fragmentCache.set(name, html);
  return html;
}

let routeSeq = 0;

export async function handleRoute() {
  const seq = ++routeSeq;
  const { path, query } = parseHash();
  const route = ROUTES[path];
  const outlet = $("#page-outlet");
  if (!outlet) return;

  if (!route) {
    if (routerHooks.notFound) return routerHooks.notFound(path);
    outlet.innerHTML = `<div class="empty-state"><div class="ico">🧭</div><h4>পেজটি খুঁজে পাওয়া যায়নি</h4><p>-route টি নেই</p><a class="btn btn-primary mt-3" style="width:auto" href="#/home">হোমে ফিরুন</a></div>`;
    return;
  }

  // guards — app.js beforeEach hook (auth state, role, blocked ইত্যাদি যাচাই)
  if (routerHooks.beforeEach) {
    const verdict = await routerHooks.beforeEach(route, path, query);
    if (verdict && verdict.redirect) {
      navigate(verdict.redirect, { replace: true });
      return;
    }
  }

  currentRoute = { path, query, route };
  window.scrollTo({ top: 0 });
  showLoading(outlet, "লোড হচ্ছে...");
  try {
    const html = await loadFragment(route.page);
    if (seq !== routeSeq) return; // stale navigation
    outlet.innerHTML = html;
    document.title = `Task Earning — ${route.page}`;
    outlet.dispatchEvent(new CustomEvent("page:rendered", { bubbles: true, detail: { path, query, route } }));
  } catch (e) {
    console.error("[router]", e);
    if (seq !== routeSeq) return;
    if (routerHooks.onError) { routerHooks.onError(e); return; }
    outlet.innerHTML = `<div class="empty-state"><div class="ico">⚠️</div><h4>পেজ লোড ব্যর্থ</h4><p>${String(e.message || e)}</p>
      <button class="btn btn-primary mt-3" style="width:auto" onclick="location.reload()">আবার চেষ্টা করুন</button></div>`;
  }
}

export function startRouter() {
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}
