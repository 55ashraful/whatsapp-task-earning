/* ============================================================
   wallet.js — ওয়ালেট, ডিপোজিট/উত্তোলন রিকোয়েস্ট, লেনদেন হিস্টোরি
   ------------------------------------------------------------
   • ব্যালেন্স ক্লায়েন্ট থেকে বাড়ানো যায় না (RTDB rules write বন্ধ)
   • Deposit/Withdrawal request শুধু 'pending' অবস্থায় তৈরি হয় —
     rules গঠন ও সীমা যাচাই করে; অনুমোদন করে শুধু Admin (server-side)
   ============================================================ */
import { ref, get, push, query, orderByChild, equalTo, limitToLast } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { $, $$, esc, toast, showLoading, v, markInvalid, btnLoading, money, fmtTime, friendlyError } from "./utils.js";
import { watchWallet, fetchSettings } from "./user.js";

function db() { return window.__WTE_DB__; }
function uid() { return window.__WTE_UID__; }

const TX_META = {
  deposit: { ico: "🏦", label: "ডিপোজিট", dir: "in" },
  deposit_refund: { ico: "↩️", label: "ডিপোজিট রিফান্ড", dir: "in" },
  task_reward: { ico: "💼", label: "টাস্ক পুরস্কার", dir: "in" },
  referral_bonus: { ico: "👥", label: "রেফারেল বোনাস", dir: "in" },
  referral_income: { ico: "📈", label: "রেফারেল ইনকাম", dir: "in" },
  spin_reward: { ico: "🎡", label: "স্পিন পুরস্কার", dir: "in" },
  task_reserve: { ico: "🔒", label: "টাস্ক বাজেট reserve", dir: "out" },
  task_refund: { ico: "🔓", label: "টাস্ক রিফান্ড", dir: "in" },
  withdrawal: { ico: "🏧", label: "উত্তোলন", dir: "out" },
  paid_spin: { ico: "🎰", label: "পেইড স্পিন", dir: "out" },
  admin_adjust: { ico: "🛠️", label: "অ্যাডমিন সমন্বয়", dir: "hold" },
};

/* ================= ওয়ালেট পেজ ================= */
export function bindWalletPage() {
  const root = $(".wallet-page");
  if (!root) return;
  const balEl = $("#wallet-available");
  watchWallet(uid(), (w) => {
    window.__WTE_WALLET__ = w;
    if (balEl) balEl.textContent = money(w.available);
    const set = (id, val) => { const n = $(id); if (n) n.textContent = money(val); };
    set("#w-pending", w.pending || 0);
    set("#w-earned", w.totalEarned || 0);
    set("#w-spent", w.totalSpent || 0);
    set("#w-reserved", w.reserved || 0);
    set("#w-withdrawn", w.totalWithdrawn || 0);
  });
  bindDepositForm();
  bindWithdrawForm();
  loadDepositHistory();
  loadWithdrawHistory();
}

async function bindDepositForm() {
  const form = $("#form-deposit");
  if (!form) return;
  const settings = await fetchSettings();
  $("#min-deposit-note").textContent = `সর্বনিম্ন ডিপোজিট ${money(settings.minDeposit)}`;
  const pn = settings.paymentNumbers || {};
  $("#pay-numbers").innerHTML = `
    <div class="pn-row"><span class="chip" style="background:#e91e63;color:#fff">bKash</span><span class="num">${esc(pn.bkash || "—")}</span>
      <button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(pn.bkash || "")}">কপি</button></div>
    <div class="pn-row"><span class="chip" style="background:#f6821f;color:#fff">Nagad</span><span class="num">${esc(pn.nagad || "—")}</span>
      <button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(pn.nagad || "")}">কপি</button></div>
    <div class="pn-row"><span class="chip" style="background:#8c3494;color:#fff">Rocket</span><span class="num">${esc(pn.rocket || "—")}</span>
      <button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(pn.rocket || "")}">কপি</button></div>`;
  $$("#pay-numbers [data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const { copyText } = await import("./utils.js");
    await copyText(b.getAttribute("data-copy"));
    toast("নম্বর কপি হয়েছে", "success");
  }));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const method = ($$('input[name="pay-method"]:checked', form) || [])[0];
    const amount = Number($("#dep-amount").value);
    const sender = $("#dep-sender").value.trim().replace(/[\s-]/g, "");
    const trx = $("#dep-trx").value.trim().toUpperCase();
    if (!method) return toast("পেমেন্ট মাধ্যম নির্বাচন করুন", "warn");
    if (!v.amount(amount, settings.minDeposit)) return markInvalid($("#dep-amount"), `সর্বনিম্ন ${money(settings.minDeposit)}`);
    if (!v.phone(sender)) return markInvalid($("#dep-sender"), "সঠিক ১১ ডিজিটের নম্বর দিন");
    if (!v.trxId(trx)) return markInvalid($("#dep-trx"), "সঠিক TrxID দিন (৬-২০ অক্ষর/সংখ্যা)");
    const restore = btnLoading($("#dep-submit"));
    try {
      // rules: শুধু নিজের pending রিকোয়েস্ট তৈরি করা যায়; admin approve করলে ব্যালেন্স যোগ হয়
      await push(ref(db(), `depositRequests/${uid()}`), {
        userId: uid(), userEmail: (window.__WTE_PROFILE__ || {}).email || "",
        method: method.value, senderNumber: sender, trxId: trx,
        amount, currency: "BDT", status: "pending",
        createdAt: Date.now(), reviewedAt: 0, adminNote: "",
      });
      toast("ডিপোজিট রিকোয়েস্ট জমা হয়েছে — Admin যাচাই করবে", "success");
      form.reset();
      loadDepositHistory();
    } catch (err) { toast(friendlyError(err), "error"); }
    finally { restore(); }
  });
}

async function loadDepositHistory() {
  const el = $("#deposit-history");
  if (!el) return;
  try {
    const snap = await get(query(ref(db(), `depositRequests/${uid()}`), orderByChild("createdAt"), limitToLast(15)));
    const rows = [];
    snap.forEach((c) => rows.push({ id: c.key, ...c.val() }));
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    el.innerHTML = rows.length ? rows.map((r) => `
      <div class="tx-item">
        <div class="tx-ico ${r.status === "approved" ? "in" : r.status === "rejected" ? "out" : "hold"}">${r.status === "approved" ? "✅" : r.status === "rejected" ? "❌" : "⏳"}</div>
        <div style="flex:1">
          <div class="tx-t">${esc(r.method.toUpperCase())} · TrxID ${esc(r.trxId)}</div>
          <div class="tx-time">${fmtTime(r.createdAt)}${r.status === "rejected" && r.adminNote ? ` · কারণ: ${esc(r.adminNote)}` : ""}</div>
        </div>
        <div class="tx-amt ${r.status === "approved" ? "in" : "hold"}">${money(r.amount)}</div>
      </div>`).join("") : `<div class="empty-state" style="padding:22px"><div class="ico">🏦</div><h4>কোনো ডিপোজিট নেই</h4></div>`;
  } catch (e) { console.warn(e); }
}

async function bindWithdrawForm() {
  const form = $("#form-withdraw");
  if (!form) return;
  const settings = await fetchSettings();
  $("#min-withdraw-note").textContent = `সর্বনিম্ন উত্তোলন ${money(settings.minWithdraw)}`;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const method = ($$('input[name="wd-method"]:checked', form) || [])[0];
    const amount = Number($("#wd-amount").value);
    const acct = $("#wd-account").value.trim().replace(/[\s-]/g, "");
    const w = window.__WTE_WALLET__ || {};
    if (!method) return toast("পেমেন্ট মাধ্যম নির্বাচন করুন", "warn");
    if (!v.amount(amount, settings.minWithdraw)) return markInvalid($("#wd-amount"), `সর্বনিম্ন ${money(settings.minWithdraw)}`);
    if (amount > Number(w.available || 0)) return markInvalid($("#wd-amount"), `উত্তোলনযোগ্য ব্যালেন্স মাত্র ${money(w.available)}`);
    if (!v.phone(acct)) return markInvalid($("#wd-account"), "সঠিক ১১ ডিজিটের নম্বর দিন");
    const restore = btnLoading($("#wd-submit"));
    try {
      // rules: amount >= minWithdraw যাচাই হয়; approve-এ server টাকা কাটে
      await push(ref(db(), `withdrawalRequests/${uid()}`), {
        userId: uid(), userEmail: (window.__WTE_PROFILE__ || {}).email || "",
        method: method.value, accountNumber: acct,
        amount, currency: "BDT", status: "pending",
        createdAt: Date.now(), reviewedAt: 0, adminNote: "",
      });
      toast("উত্তোলন রিকোয়েস্ট জমা হয়েছে — Admin ২৪-৪৮ ঘণ্টায় প্রসেস করবে", "success");
      form.reset();
      loadWithdrawHistory();
    } catch (err) { toast(friendlyError(err), "error", 4500); }
    finally { restore(); }
  });
}

async function loadWithdrawHistory() {
  const el = $("#withdraw-history");
  if (!el) return;
  try {
    const snap = await get(query(ref(db(), `withdrawalRequests/${uid()}`), orderByChild("createdAt"), limitToLast(15)));
    const rows = [];
    snap.forEach((c) => rows.push({ id: c.key, ...c.val() }));
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    el.innerHTML = rows.length ? rows.map((r) => `
      <div class="tx-item">
        <div class="tx-ico ${r.status === "approved" ? "out" : r.status === "rejected" ? "in" : "hold"}">${r.status === "approved" ? "🏧" : r.status === "rejected" ? "❌" : "⏳"}</div>
        <div style="flex:1">
          <div class="tx-t">${esc(r.method.toUpperCase())} · ${esc(r.accountNumber)}</div>
          <div class="tx-time">${fmtTime(r.createdAt)}${r.status === "rejected" && r.adminNote ? ` · কারণ: ${esc(r.adminNote)}` : ""}</div>
        </div>
        <div class="tx-amt ${r.status === "approved" ? "out" : "hold"}">-${money(r.amount)}</div>
      </div>`).join("") : `<div class="empty-state" style="padding:22px"><div class="ico">🏧</div><h4>কোনো উত্তোলন নেই</h4></div>`;
  } catch (e) { console.warn(e); }
}

/* ================= লেনদেন হিস্টোরি পেজ ================= */
export function bindTransactionPage() {
  const listEl = $("#tx-list");
  if (!listEl) return;
  load("all");
  const tabs = $$(".ftab", listEl.closest(".page"));
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("on"));
    tab.classList.add("on");
    load(tab.getAttribute("data-dir") || "all");
  }));

  async function load(dir) {
    showLoading(listEl, "লেনদেন লোড হচ্ছে...");
    try {
      const snap = await get(query(ref(db(), `transactions/${uid()}`), orderByChild("timestamp"), limitToLast(120)));
      let rows = [];
      snap.forEach((c) => rows.push({ id: c.key, ...c.val() }));
      rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      if (dir === "in") rows = rows.filter((r) => Number(r.amount) > 0);
      if (dir === "out") rows = rows.filter((r) => Number(r.amount) < 0);
      if (!rows.length) {
        listEl.innerHTML = `<div class="empty-state"><div class="ico">🧾</div><h4>কোনো লেনদেন নেই</h4><p>আয়, ডিপোজিট ও উত্তোলনের সব রেকর্ড এখানে দেখাবে</p></div>`;
        return;
      }
      listEl.innerHTML = rows.map((r) => {
        const meta = TX_META[r.type] || { ico: "💱", label: r.type, dir: Number(r.amount) >= 0 ? "in" : "out" };
        const amt = Number(r.amount);
        return `
        <div class="tx-item">
          <div class="tx-ico ${meta.dir}">${meta.ico}</div>
          <div style="flex:1;min-width:0">
            <div class="tx-t">${esc(r.title || meta.label)}</div>
            <div class="tx-time">${fmtTime(r.timestamp)} · ${esc(String(r.id || r.reference || "").slice(0, 14))}</div>
          </div>
          <div style="text-align:right">
            <div class="tx-amt ${amt >= 0 ? "in" : "out"}">${amt >= 0 ? "+" : "-"}${money(Math.abs(amt))}</div>
            <div class="small">${esc(statusTx(r.status))}</div>
          </div>
        </div>`;
      }).join("");
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state"><div class="ico">⚠️</div><h4>লোড ব্যর্থ</h4><p>${esc(friendlyError(e))}</p></div>`;
    }
  }
}
function statusTx(s) {
  return { success: "সফল", pending: "পেন্ডিং", failed: "ব্যর্থ", reserved: "Reserve", refunded: "রিফান্ড" }[s] || s || "—";
}
