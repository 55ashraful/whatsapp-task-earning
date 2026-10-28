/* admin-submissions.js — সব জমা দেখা ও বিরোধ মীমানসা (server-side re-review) */
import { ref, get, orderByChild, equalTo, limitToLast, query } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getDb } from "../../src/js/firebase-config.js";
import { esc, money, fmtTime, toast, apiCall, friendlyError, confirmDialog } from "../../src/js/utils.js";

export async function render(main, q) {
  const db = getDb();
  // nested: submissions/{taskId}/{subId} — admin root read allowed
  const rootSnap = await get(ref(db, "submissions"));
  const subs = [];
  rootSnap.forEach((tSnap) => {
    tSnap.forEach((c) => {
      const v = c.val();
      if (q.f && q.f !== "all" && v.status !== q.f) return;
      subs.push({ id: c.key, taskId: tSnap.key, ...v });
    });
  });
  subs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  main.innerHTML = `
  <div class="a-card">
    <h3>📝 সাবমিশন <span style="font-weight:400;font-size:12px;color:#64748b">${subs.length} টি</span></h3>
    <div class="a-form-row"><div style="max-width:280px"><label class="a-label">স্ট্যাটাস</label>
      <select class="a-select" id="s-filter">
        <option value="pending" ${(q.f || "pending") === "pending" ? "selected" : ""}>Pending</option>
        <option value="approved" ${q.f === "approved" ? "selected" : ""}>Approved</option>
        <option value="rejected" ${q.f === "rejected" ? "selected" : ""}>Rejected</option>
        <option value="all" ${q.f === "all" ? "selected" : ""}>সব</option>
      </select></div></div>
    <div class="a-table-wrap"><table class="a-table">
      <thead><tr><th>টাস্ক / Worker</th><th>প্রমাণ</th><th>পুরস্কার</th><th>স্ট্যাটাস</th><th>সময়</th><th>অ্যাকশন</th></tr></thead>
      <tbody>${subs.map((s) => `
        <tr>
          <td><b>${esc(s.taskTitle || "")}</b><div>${esc(s.workerName || "")} <span class="mono">${esc(s.workerId || "")}</span></div></td>
          <td>${s.proofUrl ? `<a href="${esc(s.proofUrl)}" target="_blank" rel="noopener">🖼️ ছবি</a>` : ""} ${s.proofText ? `<div style="max-width:260px;white-space:normal;font-size:12px">${esc(s.proofText)}</div>` : ""}</td>
          <td>${money(s.reward)}</td>
          <td><span class="a-pill ${esc(s.status)}">${esc(s.status)}</span>${s.rejectReason ? `<div style="font-size:11px;color:#b91c1c">${esc(s.rejectReason)}</div>` : ""}</td>
          <td>${fmtTime(s.createdAt)}</td>
          <td>${s.status === "pending" ? `
            <button class="a-btn green sm" data-ap="${esc(s.id)}" data-task="${esc(s.taskId)}">অনুমোদন</button>
            <button class="a-btn red sm" data-rj="${esc(s.id)}" data-task="${esc(s.taskId)}">প্রত্যাখ্যান</button>` : "—"}</td>
        </tr>`).join("") || '<tr><td colspan="6"><div class="a-empty">কোনো জমা নেই</div></td></tr>'}</tbody>
    </table></div>
    <div class="a-note mt-2">⚠️ Admin re-review শুধু বিরোধ মীমানসার জন্য — সব টাকার হিসাব server-side atomic ট্রানজেকশনে হয়।</div>
  </div>`;

  main.querySelector("#s-filter").addEventListener("change", (e) => { location.hash = `#/submissions?f=${e.target.value}`; });
  main.querySelectorAll("[data-ap]").forEach((b) => b.addEventListener("click", () => review(b.getAttribute("data-ap"), b.getAttribute("data-task"), "approve")));
  main.querySelectorAll("[data-rj]").forEach((b) => b.addEventListener("click", () => review(b.getAttribute("data-rj"), b.getAttribute("data-task"), "reject")));

  async function review(id, taskId, decision) {
    let reason = "";
    if (decision === "reject") {
      reason = prompt("প্রত্যাখ্যানের কারণ:") || "";
      if (reason.trim().length < 4) return toast("কারণ লিখুন", "warn");
    }
    const ok = await confirmDialog(`সাবমিশন ${decision === "approve" ? "অনুমোদন" : "প্রত্যাখ্যান"} নিশ্চিত?`, "নিশ্চিত");
    if (!ok) return;
    try {
      await apiCall("submission-review", { taskId, submissionId: id, decision, reason: reason.trim(), overrideAdmin: true });
      toast("সম্পন্ন হয়েছে", "success");
      setTimeout(() => location.reload(), 800);
    } catch (e) { toast(friendlyError(e), "error", 4500); }
  }
}
