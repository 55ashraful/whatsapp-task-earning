/* ============================================================
   notifications.js — ব্যক্তিগত নোটিফিকেশন + সিস্টেম ঘোষণা
   ============================================================ */
import { ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { $, $$, el, esc, toast, showLoading, timeAgo, friendlyError } from "./utils.js";
import { fetchSettings } from "./user.js";

export function subscribeUnread(db, uid, cb) {
  const notifRef = ref(db, `notifications/${uid}`);
  return onValue(notifRef, (snap) => {
    let count = 0;
    snap.forEach((child) => { if (!child.child("read").val()) count++; });
    cb(count);
  }, (err) => console.warn("[unread]", err.message));
}

const TYPE_ICONS = {
  submission: "📝", approved: "✅", rejected: "❌", reward: "💰", deposit: "🏦",
  withdraw: "🏧", referral: "👥", task: "📋", account: "🛡️", spin: "🎡", system: "📢",
};

export function bindNotificationsPage() {
  const listEl = $("#notif-list");
  if (!listEl) return;
  const uid = window.__WTE_UID__;
  const db = window.__WTE_DB__;
  if (!uid || !db) return;

  const tabs = $$(".ftab", listEl.closest(".page"));
  let mode = "personal";
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("on"));
    tab.classList.add("on");
    mode = tab.getAttribute("data-mode");
    render();
  }));

  let personal = [];
  let notices = [];

  onValue(ref(db, `notifications/${uid}`), async (snap) => {
    personal = [];
    snap.forEach((c) => { personal.push({ id: c.key, ...c.val() }); });
    personal.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (mode === "personal") render();
  }, (err) => { console.warn(err); showLoading(listEl, "লোড করা যায়নি"); });

  fetchSettings().then((s) => { notices = s.announcements || []; if (mode === "system") render(); });

  function render() {
    if (mode === "system") {
      listEl.innerHTML = notices.length ? notices.map((n, i) => `
        <div class="notif-item">
          <div class="n-ico" style="background:var(--primary-light)">📢</div>
          <div style="flex:1"><div class="n-t">সিস্টেম ঘোষণা</div><div class="n-b">${esc(String(n))}</div></div>
        </div>`).join("") : `<div class="empty-state"><div class="ico">📭</div><h4>কোনো ঘোষণা নেই</h4></div>`;
      return;
    }
    if (!personal.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="ico">📭</div><h4>কোনো নোটিফিকেশন নেই</h4><p>টাস্ক জমা, পুরস্কার ও লেনদেনের আপডেট এখানে দেখাবে</p></div>`;
      return;
    }
    listEl.innerHTML = personal.map((n) => `
      <div class="notif-item ${n.read ? "" : "unread"}" data-id="${esc(n.id)}">
        <div class="n-ico" style="background:var(--surface-2)">${TYPE_ICONS[n.type] || "🔔"}</div>
        <div style="flex:1;min-width:0">
          <div class="n-t">${esc(n.title || "নোটিফিকেশন")}</div>
          <div class="n-b">${esc(n.body || "")}</div>
          <div class="n-time">${timeAgo(n.createdAt)}</div>
        </div>
        ${n.read ? "" : '<span class="unread-dot"></span>'}
      </div>`).join("");
    $$(".notif-item", listEl).forEach((item) => item.addEventListener("click", async () => {
      const id = item.getAttribute("data-id");
      try { await update(ref(db, `notifications/${uid}/${id}`), { read: true }); item.classList.remove("unread"); } catch {}
    }));
  }

  const markAll = $("#mark-all-read");
  if (markAll) markAll.addEventListener("click", async () => {
    const updates = {};
    personal.filter((n) => !n.read).forEach((n) => { updates[`${n.id}/read`] = true; });
    if (!Object.keys(updates).length) return toast("সব আগেই পড়া হয়েছে", "info");
    try { await update(ref(db, `notifications/${uid}`), updates); toast("সব পড়া হয়েছে চিহ্নিত হয়েছে", "success"); }
    catch (e) { toast(friendlyError(e), "error"); }
  });
}

/** নির্দিষ্ট ইউজারের সাম্প্রতিক নোটিফিকেশন (হোমপেজে দেখানোর জন্য) */
export async function fetchRecentNotifications(db, uid, limit = 5) {
  const snap = await get(ref(db, `notifications/${uid}`));
  const out = [];
  snap.forEach((c) => out.push({ id: c.key, ...c.val() }));
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out.slice(0, limit);
}
