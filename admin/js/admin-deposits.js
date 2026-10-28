/* admin-deposits.js — ডিপোজিট রিকোয়েস্ট যাচাই, অনুমোদন/প্রত্যাখ্যান */
import { ref, get, orderByChild, equalTo, limitToLast, query } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getDb } from "../../src/js/firebase-config.js";
import { esc, money, fmtTime, toast, apiCall, friendlyError, confirmDialog } from "../../src/js/utils.js";

export async function render(main) {
  const db = getDb();
  // nested: depositRequests/{uid}/{reqId} (admin root read allowed)
  const rootSnap = await get(ref(db, "depositRequests"));
  const reqs = [];
  rootSnap.forEach((uSnap) => {
    uSnap.forEach((c) => {
      if (c.val().status === "pending") reqs.push({ id: c.key, userId: uSnap.key, ...c.val() });
    });
  });
  reqs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  main.innerHTML = `
  <div class="a-card">
    <h3>🏦 পেন্ডিং ডিপোজিট <span style="font-weight:400;font-size:12px;color:#64748b">${reqs.length} টি</span></h3>
    <div class="a-note">যাচাই করার আগে: ১) পেমেন্ট অ্যাপে TrxID মিলিয়ে দেখুন ২) পরিমাণ ঠিক আছে কি না ৩) একই TrxID আগে কখনো অনুমোদিত হয়েছে কি না (server নিজেও ডুপ্লিকেট চেক করে)।</div>
    <div class="a-table-wrap"><table class="a-table">
      <thead><tr><th>ইউজার</th><th>মাধ্যম</th><th>Sender</th><th>TrxID</th><th>পরিমাণ</th><th>সময়</th><th>অ্যাকশন</th></tr></thead>
      <tbody>${reqs.map((r) => `
        <tr>
          <td>${esc(r.userEmail || r.userId || "")}<div class="mono">${esc(r.userId || "")}</div></td>
          <td><b>${esc(String(r.method || "").toUpperCase())}</b></td>
          <td class="mono">${esc(r.senderNumber || "")}</td>
          <td class="mono">${esc(r.trxId || "")}</td>
          <td><b>${money(r.amount)}</b></td>
          <td>${fmtTime(r.createdAt)}</td>
          <td>
            <button class="a-btn green sm" data-ap="${esc(r.id)}" data-uid="${esc(r.userId || "")}" data-amt="${r.amount}">✓ অনুমোদন</button>
            <button class="a-btn red sm" data-rj="${esc(r.id)}" data-uid="${esc(r.userId || "")}">✕ বাতিল</button>
          </td>
        </tr>`).join("") || '<tr><td colspan="7"><div class="a-empty">কোনো পেন্ডিং ডিপোজিট নেই 🎉</div></td></tr>'}</tbody>
    </table></div>
  </div>`;

  main.querySelectorAll("[data-ap]").forEach((b) => b.addEventListener("click", () => review(b.getAttribute("data-ap"), b.getAttribute("data-uid"), "approve")));
  main.querySelectorAll("[data-rj]").forEach((b) => b.addEventListener("click", () => review(b.getAttribute("data-ap"), b.getAttribute("data-uid"), "reject")));

  async function review(id, uid2, decision) {
    let note = "";
    if (decision === "reject") {
      note = prompt("বাতিলের কারণ (ইউজার দেখতে পাবে):") || "";
      if (note.trim().length < 4) return toast("কারণ লিখুন", "warn");
    } else {
      const ok = await confirmDialog("অনুমোদন করলে ইউজারের ব্যালেন্সে টাকা যোগ হবে। পেমেন্ট অ্যাপে টাকা রিসিভ হয়েছে কি নিশ্চিত?", "হ্যাঁ, অনুমোদন করুন");
      if (!ok) return;
    }
    try {
      await apiCall("deposit", { action: "review", userId: uid2, requestId: id, decision, adminNote: note.trim() });
      toast(decision === "approve" ? "ব্যালেন্স যোগ হয়েছে ✅" : "বাতিল করা হয়েছে", "success");
      setTimeout(() => location.reload(), 800);
    } catch (e) { toast(friendlyError(e), "error", 5000); }
  }
}
