/* admin-users.js — ইউজার তালিকা, সার্চ, ডিটেইলস, block/unblock */
import { ref, get, limitToLast, query } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getDb } from "../../src/js/firebase-config.js";
import { esc, money, fmtTime, toast, apiCall, friendlyError, confirmDialog } from "../../src/js/utils.js";

export async function render(main, q) {
  const db = getDb();
  const snap = await get(query(ref(db, "users"), limitToLast(400)));
  const users = [];
  snap.forEach((c) => users.push({ id: c.key, ...c.val() }));
  users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  main.innerHTML = `
  <div class="a-card">
    <h3>👥 ইউজার ব্যবস্থাপনা <span style="font-weight:400;font-size:12px;color:#64748b">${users.length} জন</span></h3>
    <div class="a-form-row c2">
      <div><label class="a-label">🔍 সার্চ (নাম / ইমেইল / UID / রেফারেল কোড)</label><input class="a-input" id="u-search" placeholder="টাইপ করুন..."></div>
      <div><label class="a-label">ফিল্টার</label>
        <select class="a-select" id="u-filter">
          <option value="all">সব</option><option value="buyer">Buyer</option><option value="worker">Worker</option>
          <option value="admin">Admin</option><option value="blocked">Blocked</option><option value="pending">Pending role</option>
        </select></div>
    </div>
    <div class="a-table-wrap"><table class="a-table" id="u-table">
      <thead><tr><th>নাম</th><th>ইমেইল</th><th>রোল</th><th>স্ট্যাটাস</th><th>ব্যালেন্স</th><th>WA</th><th>রেফ. কোড</th><th>জয়েন</th><th>অ্যাকশন</th></tr></thead>
      <tbody></tbody>
    </table></div>
    <div class="a-empty hidden" id="u-empty">কোনো ইউজার পাওয়া যায়নি</div>
  </div>
  <div id="u-modal-slot"></div>`;

  const tbody = main.querySelector("#u-table tbody");
  const searchEl = main.querySelector("#u-search");
  const filterEl = main.querySelector("#u-filter");
  searchEl.value = q.q || "";
  filterEl.value = q.f || "all";

  function rows() {
    const term = searchEl.value.trim().toLowerCase();
    const f = filterEl.value;
    const list = users.filter((u) => {
      if (f === "blocked" && u.status !== "blocked") return false;
      if (["buyer", "worker", "admin", "pending"].includes(f) && u.role !== f) return false;
      if (!term) return true;
      return [u.displayName, u.email, u.uid, u.referralCode].some((x) => String(x || "").toLowerCase().includes(term));
    });
    tbody.innerHTML = list.slice(0, 200).map((u) => `
      <tr>
        <td><b>${esc(u.displayName || "—")}</b></td>
        <td>${esc(u.email || "—")}</td>
        <td><span class="a-pill ${esc(u.role || "pending")}">${esc(u.role || "pending")}</span></td>
        <td><span class="a-pill ${u.status === "blocked" ? "blocked" : "active"}">${esc(u.status || "active")}</span></td>
        <td id="w-${esc(u.id)}">...</td>
        <td>${esc((u.whatsapp || {}).number || "—")}</td>
        <td class="mono">${esc(u.referralCode || "")}</td>
        <td>${fmtTime(u.createdAt)}</td>
        <td>
          <button class="a-btn ghost sm" data-view="${esc(u.id)}">দেখুন</button>
          ${u.status === "blocked"
            ? `<button class="a-btn green sm" data-unblock="${esc(u.id)}">আনব্লক</button>`
            : `<button class="a-btn red sm" data-block="${esc(u.id)}">ব্লক</button>`}
        </td>
      </tr>`).join("");
    main.querySelector("#u-empty").classList.toggle("hidden", list.length > 0);

    tbody.querySelectorAll("[data-block]").forEach((b) => b.addEventListener("click", () => setUserStatus(b.getAttribute("data-block"), "blocked")));
    tbody.querySelectorAll("[data-unblock]").forEach((b) => b.addEventListener("click", () => setUserStatus(b.getAttribute("data-unblock"), "active")));
    tbody.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => viewUser(b.getAttribute("data-view"))));
    list.slice(0, 200).forEach((u) => loadWalletCell(u.id));
  }

  async function loadWalletCell(uid) {
    try {
      const w = await get(ref(db, `wallets/${uid}`));
      const cell = main.querySelector(`#w-${uid}`);
      if (cell) cell.textContent = w.exists() ? money(w.val().available || 0) : "৳0.00";
    } catch {}
  }

  async function setUserStatus(uid, status) {
    const ok = await confirmDialog(status === "blocked"
      ? "এই ব্যবহারকারীকে ব্লক করবেন? সে নতুন কোনো কার্যক্রম করতে পারবে না।"
      : "ব্লক থেকে আনব্লক করবেন?", status === "blocked" ? "ব্লক করুন" : "আনব্লক");
    if (!ok) return;
    try {
      await apiCall("admin", { action: status === "blocked" ? "blockUser" : "unblockUser", targetUid: uid });
      toast(status === "blocked" ? "ব্লক করা হয়েছে" : "আনব্লক হয়েছে", "success");
      const u = users.find((x) => x.id === uid);
      if (u) u.status = status;
      rows();
    } catch (e) { toast(friendlyError(e), "error", 4500); }
  }

  async function viewUser(uid) {
    const u = users.find((x) => x.id === uid) || {};
    const [wSnap, refSnap, taskSnap, subSnap] = await Promise.all([
      get(ref(db, `wallets/${uid}`)),
      get(ref(db, `referrals/${uid}`)),
      get(query(ref(db, "tasks"), limitToLast(500))).catch(() => null),
      get(ref(db, "submissions")).catch(() => null),
    ]);
    const w = wSnap.exists() ? wSnap.val() : {};
    const refCount = refSnap.exists() ? refSnap.size : 0;
    let myTasks = 0, mySubs = 0, myApproved = 0;
    if (taskSnap) taskSnap.forEach((c) => { if (c.child("buyerId").val() === uid) myTasks++; });
    if (subSnap) subSnap.forEach((c) => {
      if (c.child("workerId").val() === uid) { mySubs++; if (c.child("status").val() === "approved") myApproved++; }
    });
    const slot = main.querySelector("#u-modal-slot");
    slot.innerHTML = `<div class="a-modal-back" id="u-modal"><div class="a-modal">
      <h3>👤 ${esc(u.displayName || "—")} <span class="a-pill ${esc(u.role || "pending")}">${esc(u.role || "pending")}</span></h3>
      <div class="a-kv"><span class="k">UID</span><span class="v mono">${esc(uid)}</span></div>
      <div class="a-kv"><span class="k">ইমেইল</span><span class="v">${esc(u.email || "—")}</span></div>
      <div class="a-kv"><span class="k">WhatsApp</span><span class="v">${esc((u.whatsapp || {}).number || "—")}</span></div>
      <div class="a-kv"><span class="k">স্ট্যাটাস</span><span class="v">${esc(u.status || "active")}</span></div>
      <div class="a-kv"><span class="k">রেফারেল কোড</span><span class="v mono">${esc(u.referralCode || "—")}</span></div>
      <div class="a-kv"><span class="k">রেফার করেছে</span><span class="v">${refCount} জন${u.referredBy ? ` (রেফারড বাই: ${esc(u.referredBy)})` : ""}</span></div>
      <div class="a-kv"><span class="k">জয়েন</span><span class="v">${fmtTime(u.createdAt)}</span></div>
      <div class="a-kv"><span class="k">ওয়ালেট</span><span class="v">Available ${money(w.available || 0)} · Pending ${money(w.pending || 0)} · Earned ${money(w.totalEarned || 0)} · Spent ${money(w.totalSpent || 0)}</span></div>
      <div class="a-kv"><span class="k">কার্যক্রম</span><span class="v">টাস্ক (buyer): ${myTasks} · জমা (worker): ${mySubs} · অনুমোদিত: ${myApproved}</span></div>
      <div class="a-actions">
        ${u.status === "blocked" ? `<button class="a-btn green" id="um-unblock">আনব্লক</button>` : `<button class="a-btn red" id="um-block">ব্লক</button>`}
        ${u.role === "pending" ? `<button class="a-btn primary" id="um-worker">রোল: Worker করুন</button>` : ""}
        <button class="a-btn ghost" id="um-close">বন্ধ</button>
      </div>
    </div></div>`;
    slot.querySelector("#um-close").addEventListener("click", () => (slot.innerHTML = ""));
    slot.querySelector("#u-modal").addEventListener("click", (e) => { if (e.target.id === "u-modal") slot.innerHTML = ""; });
    const blk = slot.querySelector("#um-block");
    if (blk) blk.addEventListener("click", async () => { await setUserStatus(uid, "blocked"); slot.innerHTML = ""; });
    const ublk = slot.querySelector("#um-unblock");
    if (ublk) ublk.addEventListener("click", async () => { await setUserStatus(uid, "active"); slot.innerHTML = ""; });
    const rl = slot.querySelector("#um-worker");
    if (rl) rl.addEventListener("click", async () => {
      try { await apiCall("admin", { action: "setUserRole", targetUid: uid, role: "worker" }); toast("রোল সেট হয়েছে", "success"); slot.innerHTML = ""; const u2 = users.find((x) => x.id === uid); if (u2) u2.role = "worker"; rows(); }
      catch (e) { toast(friendlyError(e), "error"); }
    });
  }

  searchEl.addEventListener("input", rows);
  filterEl.addEventListener("change", rows);
  rows();
}
