/* ============================================================
   submissions.js — Worker-এর জমা হিস্টোরি + Buyer রিভিউ পেজ
   Approve/Reject সবসময় serverless API দিয়ে (atomic + duplicate-safe)
   ============================================================ */
import { ref, get, query, orderByChild, equalTo, limitToLast } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { $, $$, esc, toast, showLoading, btnLoading, money, fmtTime, apiCall, friendlyError, confirmDialog } from "./utils.js";
import { statusBn } from "./tasks.js";

function db() { return window.__WTE_DB__; }
function uid() { return window.__WTE_UID__; }

/* ============ Worker: আমার জমা ============ */
export async function bindSubmissionsPage(query) {
  const listEl = $("#sub-list");
  if (!listEl) return;
  const buyerMode = !!(query.task);
  if (buyerMode) return bindBuyerReview(query.task, listEl);
  await bindWorkerHistory(listEl);
}

async function bindWorkerHistory(listEl) {
  showLoading(listEl, "আপনার জমা লোড হচ্ছে...");
  try {
    // worker-এর হিস্টোরি mirror নোড থেকে (rules: নিজেরটা পড়া যায়)
    const snap = await get(query(ref(db(), `userSubmissions/${uid()}`), orderByChild("createdAt"), limitToLast(80)));
    const subs = [];
    snap.forEach((c) => subs.push({ id: c.key, ...c.val() }));
    subs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const stats = { pending: 0, approved: 0, rejected: 0 };
    subs.forEach((s) => { if (stats[s.status] !== undefined) stats[s.status]++; });
    const statEl = $("#sub-stats");
    if (statEl) {
      statEl.innerHTML = `
        <div class="stat-card gold"><div class="v">${stats.pending}</div><div class="l">অপেক্ষমাণ</div></div>
        <div class="stat-card green"><div class="v">${stats.approved}</div><div class="l">অনুমোদিত</div></div>
        <div class="stat-card red"><div class="v">${stats.rejected}</div><div class="l">প্রত্যাখৃত</div></div>`;
    }

    if (!subs.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="ico">📭</div><h4>কোনো জমা নেই</h4><p>টাস্ক শুরু করে কাজ শেষে প্রমাণ জমা দিন</p><a class="btn btn-primary mt-3" style="width:auto" href="#/tasks">টাস্ক দেখুন</a></div>`;
      return;
    }
    listEl.innerHTML = subs.map((s) => `
      <div class="review-card">
        <div class="rc-head">
          <div>
            <div class="rc-worker">${esc(s.taskTitle || "টাস্ক")}</div>
            <div class="rc-time">${fmtTime(s.createdAt)}</div>
          </div>
          <span class="status-pill ${esc(s.status)}">${statusBn(s.status)}</span>
        </div>
        ${s.proofText ? `<div class="proof-text">${esc(s.proofText)}</div>` : ""}
        ${s.proofUrl ? `<a href="${esc(s.proofUrl)}" target="_blank" rel="noopener"><img class="proof-img" src="${esc(s.proofUrl)}" alt="proof" loading="lazy" onerror="this.style.display='none'"></a>` : ""}
        ${s.status === "rejected" && s.rejectReason ? `<div class="reason-box">প্রত্যাখ্যানের কারণ: ${esc(s.rejectReason)}</div>` : ""}
        ${s.status === "approved" ? `<div class="alert alert-success mt-2">+${money(s.reward)} ওয়ালেটে যোগ হয়েছে</div>` : ""}
      </div>`).join("");
  } catch (e) {
    listEl.innerHTML = `<div class="empty-state"><div class="ico">⚠️</div><h4>লোড ব্যর্থ</h4><p>${esc(friendlyError(e))}</p></div>`;
  }
}

/* ============ Buyer: নিজের টাস্কের জমা রিভিউ ============ */
async function bindBuyerReview(taskId, listEl) {
  showLoading(listEl, "জমা লোড হচ্ছে...");
  let task = null;
  try {
    const tsnap = await get(ref(db(), `tasks/${taskId}`));
    if (!tsnap.exists()) { listEl.innerHTML = emptyState("টাস্ক পাওয়া যায়নি"); return; }
    task = { id: tsnap.key, ...tsnap.val() };
    if (task.buyerId !== uid()) { listEl.innerHTML = emptyState("এই টাস্ক আপনার নয় — রিভিউ করার অনুমতি নেই"); return; }
  } catch (e) { listEl.innerHTML = emptyState(friendlyError(e)); return; }

  const headEl = $("#sub-head");
  if (headEl) {
    headEl.innerHTML = `
      <div class="card">
        <div class="row-between">
          <div><div class="card-title">${esc(task.title)}</div><span class="muted small">প্রতি কাজ: ${money(task.reward)}</span></div>
          <span class="status-pill ${esc(task.status)}">${statusBn(task.status)}</span>
        </div>
      </div>`;
  }

  try {
    // টাস্কভিত্তিক জমা নোড (rules: টাস্কের Buyer-ই পড়তে পারে)
    const snap = await get(query(ref(db(), `submissions/${taskId}`), orderByChild("createdAt"), limitToLast(120)));
    const subs = [];
    snap.forEach((c) => subs.push({ id: c.key, ...c.val() }));
    subs.sort((a, b) => {
      const w = { pending: 0, approved: 1, rejected: 2 };
      return (w[a.status] ?? 3) - (w[b.status] ?? 3) || (b.createdAt || 0) - (a.createdAt || 0);
    });
    if (!subs.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="ico">📭</div><h4>এখনও কোনো জমা নেই</h4><p>Worker-রা কাজ জমা দিলে এখানে দেখাবে</p></div>`;
      return;
    }
    listEl.innerHTML = subs.map((s) => `
      <div class="review-card" data-sub="${esc(s.id)}">
        <div class="rc-head">
          <div>
            <div class="rc-worker">🛠️ ${esc(s.workerName || "Worker")}</div>
            <div class="rc-time">${fmtTime(s.createdAt)}</div>
          </div>
          <span class="status-pill ${esc(s.status)}">${statusBn(s.status)}</span>
        </div>
        ${s.proofText ? `<div class="proof-text">${esc(s.proofText)}</div>` : ""}
        ${s.proofUrl ? `<a href="${esc(s.proofUrl)}" target="_blank" rel="noopener"><img class="proof-img" src="${esc(s.proofUrl)}" alt="proof" loading="lazy" onerror="this.style.display='none'"></a>` : ""}
        ${s.reference ? `<div class="small mt-1">রেফারেন্স: ${esc(s.reference)}</div>` : ""}
        ${s.status === "rejected" && s.rejectReason ? `<div class="reason-box">কারণ: ${esc(s.rejectReason)}</div>` : ""}
        ${s.status === "pending" ? `
        <div class="form-group mt-2">
          <input type="text" class="form-control reject-reason" placeholder="প্রত্যাখ্যানের কারণ (Reject করলে আবশ্যক)">
        </div>
        <div class="review-actions">
          <button class="btn btn-danger" data-act="reject">✕ প্রত্যাখ্যান</button>
          <button class="btn btn-success" data-act="approve">✓ অনুমোদন (+${money(s.reward)})</button>
        </div>` : ""}
      </div>`).join("");

    $$("[data-sub]", listEl).forEach((card) => {
      const approveBtn = $('[data-act="approve"]', card);
      const rejectBtn = $('[data-act="reject"]', card);
      if (approveBtn) approveBtn.addEventListener("click", () => review(card, "approve"));
      if (rejectBtn) rejectBtn.addEventListener("click", () => review(card, "reject"));
    });
  } catch (e) {
    listEl.innerHTML = emptyState(friendlyError(e));
  }

  async function review(card, act) {
    const subId = card.getAttribute("data-sub");
    let reason = "";
    if (act === "reject") {
      reason = ($(".reject-reason", card) || {}).value || "";
      if (reason.trim().length < 4) return toast("প্রত্যাখ্যানের কারণ লিখুন (কমপক্ষে ৪ অক্ষর)", "warn");
      const ok = await confirmDialog(`কাজটি প্রত্যাখ্যান করবেন? পুরস্কার Buyer-কে রিফান্ড হবে।`, "প্রত্যাখ্যান করুন");
      if (!ok) return;
    } else {
      const ok = await confirmDialog(`কাজটি অনুমোদন করবেন? Worker-এর ওয়ালেটে পুরস্কার যোগ হবে।`, "অনুমোদন করুন");
      if (!ok) return;
    }
    const btn = $(`[data-act="${act}"]`, card);
    const restore = btnLoading(btn);
    try {
      await apiCall("submission-review", { taskId, submissionId: subId, decision: act, reason: reason.trim() });
      toast(act === "approve" ? "অনুমোদিত — Worker পুরস্কার পেয়েছে ✅" : "প্রত্যাখ্যান করা হয়েছে", "success");
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      toast(friendlyError(e), "error", 4500);
      restore();
    }
  }
}

function emptyState(msg) {
  return `<div class="empty-state"><div class="ico">⚠️</div><h4>${esc(msg)}</h4><a class="btn btn-primary mt-3" style="width:auto" href="#/my-tasks">আমার টাস্ক</a></div>`;
}
