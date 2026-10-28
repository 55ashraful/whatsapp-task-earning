/* ============================================================
   home.js — হোম ড্যাশবোর্ড (রেফারেন্স সাইটের মতো payout কার্ড,
   মার্কি, ব্যানার, কুইক অ্যাকশন, WhatsApp কার্ড, গাইড, পপআপ)
   ============================================================ */
import { ref, get, query, orderByChild, equalTo, limitToLast } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { $, $$, esc, money, fmtTime, showLoading, openModal, toast, friendlyError } from "./utils.js";
import { fetchSettings, fetchGlobalStats, watchWallet } from "./user.js";
import { fetchRecentNotifications } from "./notifications.js";
import { catMeta } from "./tasks.js";

function db() { return window.__WTE_DB__; }
function uid() { return window.__WTE_UID__; }

export async function bindHomePage() {
  const root = $("#page-outlet");
  const prof = window.__WTE_PROFILE__ || {};

  // ওয়ালেট ব্যালেন্স কার্ড
  watchWallet(uid(), (w) => {
    window.__WTE_WALLET__ = w;
    const el = $("#home-balance");
    if (el) el.textContent = money(w.available || 0);
  });

  // গ্লোবাল স্ট্যাট + সেটিংস
  Promise.all([fetchGlobalStats(), fetchSettings()]).then(([stats, settings]) => {
    const payout = $("#global-payout");
    if (payout) payout.textContent = money(stats.totalPayout || 0);
    const users = $("#global-users");
    if (users) users.textContent = String(stats.totalUsers || 0);
    const marquee = $("#marquee-track");
    if (marquee && settings.announcements.length) {
      const items = settings.announcements.map((a) => `<span>${esc(String(a))}</span>`).join("");
      marquee.innerHTML = items + items; // seamless loop
    }
  });

  // ব্যানার ক্যারোসেল
  const slides = $("#banner-slides");
  if (slides) {
    const banners = [
      "public/assets/images/banner-home.svg",
      "public/assets/images/banner-deposit.svg",
      "public/assets/images/banner-refer.svg",
    ];
    slides.innerHTML = banners.map((b) => `<img src="${b}" alt="banner">`).join("");
    let idx = 0;
    const dots = $("#banner-dots");
    if (dots) dots.innerHTML = banners.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("");
    setInterval(() => {
      idx = (idx + 1) % banners.length;
      slides.style.transform = `translateX(-${idx * 100}%)`;
      if (dots) $$("i", dots).forEach((d, i) => d.classList.toggle("on", i === idx));
    }, 4000);
  }

  // রোল-ভিত্তিক সেকশন
  const isBuyer = prof.role === "buyer";
  $("#home-role-sections").innerHTML = isBuyer ? buyerSections() : workerSections();

  if (isBuyer) {
    loadMyBuyerTasks();
  } else {
    loadAvailableTasksPreview();
  }
  loadRecentActivity();

  // ওয়েলকাম পপআপ (প্রতি সেশনে একবার)
  if (!sessionStorage.getItem("wte_welcome_shown")) {
    sessionStorage.setItem("wte_welcome_shown", "1");
    openModal(`
      <div class="welcome-modal">
        <div class="wm-emo">🎁</div>
        <h3>স্বাগতম, ${esc(prof.displayName || "বন্ধু")}!</h3>
        <p>টাস্ক সম্পন্ন করে, বন্ধু রেফার করে ও ডেইলি স্পিনে আয় শুরু করুন।</p>
        ${!(prof.whatsapp || {}).number ? `<p>💡 <b>WhatsApp নম্বর যুক্ত করলে</b> প্রচারমূলক টাস্ক সবার আগে পাবেন।</p>` : ""}
        <button class="btn btn-primary" onclick="document.querySelector('.modal-backdrop').remove();document.body.style.overflow=''">শুরু করুন</button>
      </div>`, {});
  }
}

function buyerSections() {
  return `
  <div class="quick-actions mb-3">
    <a class="qa" href="#/create-task"><span class="qa-ico green">➕</span><span>টাস্ক তৈরি</span></a>
    <a class="qa" href="#/my-tasks"><span class="qa-ico blue">📋</span><span>আমার টাস্ক</span></a>
    <a class="qa" href="#/submissions"><span class="qa-ico gold">📝</span><span>রিভিউ</span></a>
    <a class="qa" href="#/wallet"><span class="qa-ico purple">💳</span><span>ডিপোজিট</span></a>
  </div>
  <div class="section-head"><h3>আমার টাস্ক</h3><a href="#/my-tasks" class="small bold">সব দেখুন →</a></div>
  <div id="home-my-tasks"></div>`;
}

function workerSections() {
  return `
  <div class="quick-actions mb-3">
    <a class="qa" href="#/tasks"><span class="qa-ico blue">🧩</span><span>টাস্ক খুঁজুন</span></a>
    <a class="qa" href="#/submissions"><span class="qa-ico gold">📝</span><span>আমার জমা</span></a>
    <a class="qa" href="#/spin"><span class="qa-ico pink">🎡</span><span>স্পিন</span></a>
    <a class="qa" href="#/referral"><span class="qa-ico green">👥</span><span>রেফার</span></a>
  </div>
  <div class="section-head"><h3>উপলব্ধ টাস্ক</h3><a href="#/tasks" class="small bold">সব দেখুন →</a></div>
  <div id="home-tasks-preview"></div>`;
}

async function loadMyBuyerTasks() {
  const el = $("#home-my-tasks");
  if (!el) return;
  showLoading(el, "...");
  try {
    const snap = await get(query(ref(db(), "tasks"), orderByChild("buyerId"), equalTo(uid()), limitToLast(3)));
    const tasks = [];
    snap.forEach((c) => tasks.push({ id: c.key, ...c.val() }));
    tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    el.innerHTML = tasks.length ? tasks.map((tk) => `
      <div class="task-card">
        <div class="tc-top">
          <div class="tc-title">${esc(tk.title)}</div>
          <span class="status-pill ${esc(tk.status)}">${{ active: "চলমান", completed: "সম্পন্ন", cancelled: "বাতিল", blocked: "বন্ধ", full: "পূর্ণ" }[tk.status] || tk.status}</span>
        </div>
        <div class="tc-meta mt-1"><span>💰 ${money(tk.reward)}</span><span>✅ অনুমোদিত: ${tk.approvedCount || 0}/${tk.slots}</span></div>
        <div class="tc-foot"><span class="small">${fmtTime(tk.createdAt)}</span><a class="btn btn-primary btn-sm" href="#/submissions?task=${tk.id}">রিভিউ</a></div>
      </div>`).join("")
      : `<div class="card empty-state" style="padding:26px"><div class="ico">🚀</div><h4>প্রথম টাস্ক তৈরি করুন</h4><p>Worker নিয়োগ করে আপনার কাজ দ্রুত শেষ করান</p><a class="btn btn-primary mt-3" style="width:auto" href="#/create-task">➕ টাস্ক তৈরি করুন</a></div>`;
  } catch (e) { el.innerHTML = `<div class="alert alert-error">${esc(friendlyError(e))}</div>`; }
}

async function loadAvailableTasksPreview() {
  const el = $("#home-tasks-preview");
  if (!el) return;
  showLoading(el, "...");
  try {
    const snap = await get(query(ref(db(), "tasks"), orderByChild("status"), equalTo("active"), limitToLast(4)));
    const tasks = [];
    snap.forEach((c) => tasks.push({ id: c.key, ...c.val() }));
    tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    await Promise.all(tasks.map(async (tk) => {
      try {
        const aSnap = await get(ref(db(), `taskAssignments/${tk.id}`));
        tk.filled = aSnap.exists() ? aSnap.size : 0;
      } catch { tk.filled = 0; }
    }));
    el.innerHTML = tasks.length ? tasks.map((tk) => {
      const remaining = Math.max(0, (tk.slots || 0) - (tk.filled || 0));
      return `
      <div class="task-card">
        <div class="tc-top">
          <div class="tc-title">${esc(tk.title)}</div>
          <span class="chip tc-cat">${catMeta(tk.category).ico} ${esc(catMeta(tk.category).label)}</span>
        </div>
        <div class="tc-meta mt-1">
          <span>💰 <b>${money(tk.reward)}</b></span>
          <span>🪑 অবশিষ্ট: <b>${remaining}</b></span>
        </div>
        <div class="tc-foot">
          <span class="small">${remaining > 0 ? "⏳ এখনই শুরু করুন" : "🔴 পূর্ণ"}</span>
          <a class="btn btn-primary btn-sm" href="#/task-details?id=${tk.id}">বিস্তারিত</a>
        </div>
      </div>`;
    }).join("")
      : `<div class="card empty-state" style="padding:26px"><div class="ico">📭</div><h4>এখন কোনো টাস্ক নেই</h4><p>নতুন টাস্ক আসলে এখানে দেখাবে</p></div>`;
  } catch (e) { el.innerHTML = `<div class="alert alert-error">${esc(friendlyError(e))}</div>`; }
}

async function loadRecentActivity() {
  const el = $("#home-activity");
  if (!el) return;
  try {
    const notifs = await fetchRecentNotifications(db(), uid(), 4);
    el.innerHTML = notifs.length ? notifs.map((n) => `
      <div class="list-item">
        <div class="li-ico">${({ approved: "✅", rejected: "❌", reward: "💰", deposit: "🏦", withdraw: "🏧", referral: "👥", task: "📋", spin: "🎡" }[n.type] || "🔔")}</div>
        <div class="li-body">
          <div class="li-title">${esc(n.title || "")}</div>
          <div class="li-sub">${esc(n.body || "")} · ${fmtTime(n.createdAt)}</div>
        </div>
      </div>`).join("")
      : `<div class="empty-state" style="padding:18px"><div class="ico">🌙</div><h4>সাম্প্রতিক কোনো কার্যক্রম নেই</h4></div>`;
  } catch { el.innerHTML = ""; }
}
