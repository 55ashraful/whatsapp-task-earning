/* admin-withdrawals.js — উত্তোলন রিকোয়েস্ট প্রসেসিং */
import { ref, get, orderByChild, equalTo, limitToLast, query } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getDb } from "../../src/js/firebase-config.js";
import { esc, money, fmtTime, toast, apiCall, friendlyError, confirmDialog } from "../../src/js/utils.js";

export async function render(main) {
  const db = getDb();
  // nested: withdrawalRequests/{uid}/{reqId}
  const rootSnap = await get(ref(db, "withdrawalRequests"));
  const reqs = [];
  rootSnap.forEach((uSnap) => {
    uSnap.forEach((c) => {
      if (c.val().status === "pending") reqs.push({ id: c.key, userId: uSnap.key, ...c.val() });
    });
  });
  reqs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  main.innerHTML = `
  <div class="a-card">
    <h3>🏧 পেন্ডিং উত্তোলন <span style="font-weight:400;font-size:12px;color:#64748b">${reqs.length} টি</span></h3>
    <div class="a-note">অনুমোদন করলে server ইউজারের ব্যালেন্স থেকে টাকা কেটে নেবে — তারপর আপনি ম্যানুয়ালি Send Money করবেন। ব্যালেন্স অপর্যাপ্ত হলে server এরর দেবে।</div>
    <div class="a-table-wrap"><table class="a-table">
      <thead><tr><th>ইউজার</th><th>মাধ্যম</th><th>অ্যাকাউন্ট</th><th>পরিমাণ</th><th>রিকোয়েস্ট</th><th>অ্যাকশন</th></tr></thead>
      <tbody>${reqs.map((r) => `
        <tr>
          <td>${esc(r.userEmail || "")}<div class="mono">${esc(r.userId || "")}</div></td>
          <td><b>${esc(String(r.method || "").toUpperCase())}</b></td>
          <td class="mono">${esc(r.accountNumber || "")}</td>
          <td><b>${money(r.amount)}</b></td>
          <td>${fmtTime(r.createdAt)}</td>
          <td>
            <button class="a-btn green sm" data-ap="${esc(r.id)}" data-uid="${esc(r.userId || "")}">✓ পে করে অনুমোদন</button>
            <button class="a-btn red sm" data-rj="${esc(r.id)}" data-uid="${esc(r.userId || "")}">✕ বাতিল</button>
          </td>
        </tr>`).join("") || '<tr><td colspan="6"><div class="a-empty">কোনো পেন্ডিং উত্তোলন নেই 🎉</div></td></tr>'}</tbody>
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
      const ok = await confirmDialog("প্রথমে ইউজারের নম্বরে Send Money করুন, তারপর অনুমোদন চাপুন — ব্যালেন্স কাটা হবে। পেমেন্ট সম্পন্ন?", "হ্যাঁ, পেমেন্ট সম্পন্ন");
      if (!ok) return;
    }
    try {
      await apiCall("withdrawal", { action: "review", userId: uid2, requestId: id, decision, adminNote: note.trim() });
      toast(decision === "approve" ? "উত্তোলন সম্পন্ন ✅" : "বাতিল করা হয়েছে", "success");
      setTimeout(() => location.reload(), 800);
    } catch (e) { toast(friendlyError(e), "error", 5000); }
  }
}
