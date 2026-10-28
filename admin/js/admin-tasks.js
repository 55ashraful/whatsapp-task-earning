/* admin-tasks.js — সব টাস্ক দেখা, ফিল্টার, বন্ধ/চালু করা */
import { ref, get, limitToLast, query } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getDb } from "../../src/js/firebase-config.js";
import { esc, money, fmtTime, toast, apiCall, friendlyError, confirmDialog } from "../../src/js/utils.js";

export async function render(main, q) {
  const db = getDb();
  const snap = await get(query(ref(db, "tasks"), limitToLast(300)));
  const tasks = [];
  snap.forEach((c) => tasks.push({ id: c.key, ...c.val() }));
  tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  main.innerHTML = `
  <div class="a-card">
    <h3>📋 টাস্ক ব্যবস্থাপনা <span style="font-weight:400;font-size:12px;color:#64748b">${tasks.length} টি</span></h3>
    <div class="a-form-row c2">
      <div><label class="a-label">🔍 সার্চ (শিরোনাম / Buyer)</label><input class="a-input" id="t-search"></div>
      <div><label class="a-label">স্ট্যাটাস</label>
        <select class="a-select" id="t-filter">
          <option value="all">সব</option><option value="active">Active</option><option value="full">Full</option>
          <option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="blocked">Blocked</option>
        </select></div>
    </div>
    <div class="a-table-wrap"><table class="a-table">
      <thead><tr><th>টাস্ক</th><th>Buyer</th><th>পুরস্কার</th><th>স্লট</th><th>Reserve</th><th>স্ট্যাটাস</th><th>তারিখ</th><th>অ্যাকশন</th></tr></thead>
      <tbody id="t-body"></tbody>
    </table></div>
  </div>`;

  const tbody = main.querySelector("#t-body");
  const searchEl = main.querySelector("#t-search");
  const filterEl = main.querySelector("#t-filter");
  searchEl.value = q.q || ""; filterEl.value = q.f || "all";

  function rows() {
    const term = searchEl.value.trim().toLowerCase();
    const f = filterEl.value;
    const list = tasks.filter((t) => {
      if (f !== "all" && t.status !== f) return false;
      if (!term) return true;
      return [t.title, t.buyerName].some((x) => String(x || "").toLowerCase().includes(term));
    });
    tbody.innerHTML = list.slice(0, 200).map((t) => `
      <tr>
        <td><b>${esc(t.title)}</b><div class="mono">${esc(t.id)}</div></td>
        <td>${esc(t.buyerName || "—")}</td>
        <td>${money(t.reward)}</td>
        <td>${t.filled || 0}/${t.slots}</td>
        <td>${money(t.reservedRemaining || 0)}</td>
        <td><span class="a-pill ${esc(t.status)}">${esc(t.status)}</span></td>
        <td>${fmtTime(t.createdAt)}</td>
        <td>
          ${["active", "full"].includes(t.status)
            ? `<button class="a-btn red sm" data-close="${esc(t.id)}">বন্ধ করুন</button>`
            : t.status === "blocked" ? `<button class="a-btn green sm" data-reopen="${esc(t.id)}">চালু করুন</button>` : "—"}
        </td>
      </tr>`).join("") || '<tr><td colspan="8"><div class="a-empty">কোনো টাস্ক নেই</div></td></tr>';

    tbody.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeTask(b.getAttribute("data-close"))));
    tbody.querySelectorAll("[data-reopen]").forEach((b) => b.addEventListener("click", () => reopenTask(b.getAttribute("data-reopen"))));
  }

  async function closeTask(id) {
    const ok = await confirmDialog("টাস্কটি বন্ধ করবেন? অব্যবহৃত reserve Buyer-কে রিফান্ড হবে, পেন্ডিং জমা প্রত্যাখ্যান হবে।", "বন্ধ করুন");
    if (!ok) return;
    try { await apiCall("admin", { action: "closeTask", taskId: id }); toast("টাস্ক বন্ধ ও রিফান্ড সম্পন্ন", "success"); const t = tasks.find((x) => x.id === id); if (t) t.status = "blocked"; rows(); }
    catch (e) { toast(friendlyError(e), "error", 4500); }
  }
  async function reopenTask(id) {
    try { await apiCall("admin", { action: "reopenTask", taskId: id }); toast("টাস্ক পুনরায় চালু", "success"); const t = tasks.find((x) => x.id === id); if (t) t.status = "active"; rows(); }
    catch (e) { toast(friendlyError(e), "error", 4500); }
  }

  searchEl.addEventListener("input", rows);
  filterEl.addEventListener("change", rows);
  rows();
}
