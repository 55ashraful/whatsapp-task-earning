/* ============================================================
   referrals.js — রেফারেল কোড/লিংক, আমন্ত্রিত বন্ধু, মাইলস্টোন বোনাস
   বোনাস দেয় শুধু server (প্রথম অনুমোদিত টাস্কে, একবারই — ভুয়া রেফার প্রতিরোধ)
   ============================================================ */
import { ref, get, query, orderByChild, equalTo, limitToLast } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { $, esc, toast, showLoading, money, fmtDate, friendlyError, copyText } from "./utils.js";
import { fetchSettings } from "./user.js";

function db() { return window.__WTE_DB__; }
function uid() { return window.__WTE_UID__; }

const MILESTONES = [
  { friends: 3, bonus: 20 }, { friends: 8, bonus: 40 },
  { friends: 18, bonus: 120 }, { friends: 38, bonus: 300 },
];

export async function bindReferralPage() {
  const root = $(".refer-page");
  if (!root) return;
  const prof = window.__WTE_PROFILE__ || {};
  const settings = await fetchSettings();

  const code = prof.referralCode || "—";
  const base = location.origin + location.pathname;
  const link = `${base}#/register?ref=${code}`;

  $("#ref-code").textContent = code;
  $("#ref-link").value = link;
  $("#ref-percent").textContent = `${settings.referIncomePercent || 5}%`;
  $("#ref-transfer-min").textContent = money(settings.referTransferMin || 50);
  $("#ref-bonus-per-friend").textContent = money(settings.referralBonusPerFriend || 20);

  $("#copy-code").addEventListener("click", async () => { await copyText(code); toast("কোড কপি হয়েছে", "success"); });
  $("#copy-link").addEventListener("click", async () => { await copyText(link); toast("লিংক কপি হয়েছে", "success"); });
  $("#share-link").addEventListener("click", async () => {
    const text = `টাস্ক করে আয় করুন! আমার রেফারেল কোড: ${code} — জয়েন করুন: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Task Earning", text, url: link }); } catch {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  });

  // আমন্ত্রিত বন্ধু + মাইলস্টোন
  showLoading($("#ref-friends"), "লোড হচ্ছে...");
  try {
    const snap = await get(ref(db(), `referrals/${uid()}`));
    const friends = [];
    snap.forEach((c) => friends.push({ uid: c.key, ...c.val() }));
    friends.sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
    $("#rs-total").textContent = String(friends.length);
    $("#rs-today").textContent = String(friends.filter((f) => new Date(f.joinedAt || 0).toDateString() === new Date().toDateString()).length);

    const msEl = $("#ref-milestones");
    msEl.innerHTML = MILESTONES.map((m) => {
      const done = friends.length >= m.friends;
      const pct = Math.min(100, (friends.length / m.friends) * 100);
      return `
      <div class="milestone ${done ? "done" : ""}">
        <span class="ms-n">${m.friends} জন</span>
        <div class="ms-bar"><div class="progress"><span style="width:${pct}%"></span></div></div>
        <span class="ms-amt">+${money(m.bonus)}</span>
      </div>`;
    }).join("");

    $("#ref-friends").innerHTML = friends.length ? friends.map((f) => `
      <div class="list-item">
        <div class="li-ico">👤</div>
        <div class="li-body">
          <div class="li-title">${esc(f.displayName || "বন্ধু")}</div>
          <div class="li-sub">জয়েন: ${fmtDate(f.joinedAt)}</div>
        </div>
      </div>`).join("") : `<div class="empty-state"><div class="ico">👥</div><h4>এখনও কোনো বন্ধু জয়েন করেননি</h4><p>লিংক শেয়ার করুন — বন্ধুর প্রথম অনুমোদিত টাস্কে আপনি বোনাস পাবেন</p></div>`;
  } catch (e) {
    $("#ref-friends").innerHTML = `<div class="empty-state"><div class="ico">⚠️</div><h4>${esc(friendlyError(e))}</h4></div>`;
  }

  // রেফারেল রিওয়ার্ড ব্যালেন্স (server লেখে)
  try {
    const rw = await get(ref(db(), `referralRewardBalance/${uid()}`));
    const amt = rw.exists() ? Number(rw.val().amount || 0) : 0;
    $("#ref-balance").textContent = money(amt);
    const transferBtn = $("#ref-transfer");
    transferBtn.disabled = amt < Number(settings.referTransferMin || 50);
    transferBtn.addEventListener("click", async () => {
      const { apiCall } = await import("./utils.js");
      const restore0 = transferBtn.innerHTML;
      transferBtn.disabled = true;
      transferBtn.innerHTML = '<span class="spinner"></span>';
      try {
        await apiCall("task", { action: "transferReferral", });
        toast("মূল ব্যালেন্সে ট্রান্সফার হয়েছে ✅", "success");
        setTimeout(() => location.reload(), 900);
      } catch (e) {
        toast(friendlyError(e), "error");
        transferBtn.disabled = false; transferBtn.innerHTML = restore0;
      }
    });
  } catch {}
}
