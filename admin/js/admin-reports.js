/* admin-reports.js — ইউজার রিপোর্ট মীমানসা + অডিট লগ */
import { ref, get, orderByChild, limitToLast, query } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getDb } from "../../src/js/firebase-config.js";
import { esc, fmtTime, toast, apiCall, friendlyError, confirmDialog } from "../../src/js/utils.js";

export async function render(main) {
  const db = getDb();
  const snap = await get(query(ref(db, "reports"), limitToLast(200)));
  const reports = [];
  snap.forEach((c) => reports.push({ id: c.key, ...c.val() }));
  reports.sort((a, b) => {
    const w = { open: 0, resolved: 1 };
    return (w[a.status] ?? 2) - (w[b.status] ?? 2) || (b.createdAt || 0) - (a.createdAt || 0);
  });

  main.innerHTML = `
  <div class="a-card">
    <h3>🚩 ইউজার রিপোর্ট <span style="font-weight:400;font-size:12px;color:#64748b">${reports.filter((r) => r.status === "open").length} টি খোলা</span></h3>
    <div class="a-table-wrap"><table class="a-table">
      <thead><tr><th>রিপোর্টার</th><th>টার্গেট</th><th>কারণ</th><th>সময়</th><th>স্ট্যাটাস</th><th>অ্যাকশন</th></tr></thead>
      <tbody>${reports.map((r) => `
        <tr>
          <td class="mono">${esc(r.reporterId || "")}</td>
          <td>${esc(r.targetType || "")} <div class="mono">${esc(r.targetId || "")}</div></td>
          <td style="max-width:280px;white-space:normal">${esc(r.reason || "")}</td>
          <td>${fmtTime(r.createdAt)}</td>
          <td><span class="a-pill ${r.status === "open" ? "pending" : "resolved"}">${esc(r.status || "open")}</span>${r.adminNote ? `<div style="font-size:11px">${esc(r.adminNote)}</div>` : ""}</td>
          <td>${r.status === "open" ? `<button class="a-btn primary sm" data-res="${esc(r.id)}">Resolve</button>` : "—"}</td>
        </tr>`).join("") || '<tr><td colspan="6"><div class="a-empty">কোনো রিপোর্ট নেই 🎉</div></td></tr>'}</tbody>
    </table></div>
  </div>`;

  main.querySelectorAll("[data-res]").forEach((b) => b.addEventListener("click", async () => {
    const note = prompt("Resolve নোট (ঐচ্ছিক):") || "";
    try {
      await apiCall("admin", { action: "resolveReport", reportId: b.getAttribute("data-res"), adminNote: note.trim() });
      toast("রিপোর্ট Resolve হয়েছে", "success");
      setTimeout(() => location.reload(), 700);
    } catch (e) { toast(friendlyError(e), "error"); }
  }));
}

export async function renderAudit(main) {
  const db = getDb();
  const snap = await get(query(ref(db, "adminAuditLogs"), orderByChild("at"), limitToLast(300)));
  const logs = [];
  snap.forEach((c) => logs.push({ id: c.key, ...c.val() }));
  logs.sort((a, b) => (b.at || 0) - (a.at || 0));
  main.innerHTML = `
  <div class="a-card">
    <h3>🧾 Admin অডিট লগ <span style="font-weight:400;font-size:12px;color:#64748b">${logs.length} এন্ট্রি</span></h3>
    <div class="a-table-wrap"><table class="a-table">
      <thead><tr><th>সময়</th><th>Admin</th><th>অ্যাকশন</th><th>টার্গেট</th><th>বিস্তারিত</th></tr></thead>
      <tbody>${logs.map((l) => `
        <tr>
          <td>${fmtTime(l.at)}</td>
          <td>${esc(l.adminEmail || "")}<div class="mono">${esc(l.adminUid || "")}</div></td>
          <td><b>${esc(l.action || "")}</b></td>
          <td class="mono">${esc(l.target || "")}</td>
          <td style="font-size:12px">${esc(l.details || "")}</td>
        </tr>`).join("") || '<tr><td colspan="5"><div class="a-empty">লগ খালি</div></td></tr>'}</tbody>
    </table></div>
    <div class="a-note mt-2">সব Admin অ্যাকশন server-side এই লগে রেকর্ড হয় — টেম্পার-প্রুফ ট্রেইল হিসেবে ব্যবহার করুন।</div>
  </div>`;
}
