/* ============================================================
   spin.js — লাকি ক্যাশ হুইল
   ------------------------------------------------------------
   • পুরস্কারের সিদ্ধান্ত ১০০% সার্ভার-সাইডে (/api/spin) — ওজনসহ
     সেগমেন্ট থেকে server বেছে নেয়; client শুধু অ্যানিমেশন করে
   • ফ্রি স্পিন: দৈনিক সীমা + কুলডাউন (server যাচাই করে)
   • পেইড স্পিন: ব্যালেন্স থেকে server টাকা কাটে
   • একই স্পিনের পুরস্কার দুবার দেওয়ার সুযোগ নেই (server-side state)
   ============================================================ */
import { ref, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { $, esc, toast, btnLoading, money, fmtTime, apiCall, friendlyError } from "./utils.js";
import { fetchSettings, watchWallet } from "./user.js";

const SEG_COLORS = ["#f43f5e", "#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#6366f1", "#14b8a6"];
let settings = null;
let spinning = false;

export async function bindSpinPage() {
  const root = $(".spin-page");
  if (!root) return;
  settings = await fetchSettings();
  watchWallet(window.__WTE_UID__, (w) => {
    window.__WTE_WALLET__ = w;
    const b = $("#sp-balance");
    if (b) b.textContent = money(w.available || 0);
    const paid = $("#btn-paid-spin");
    if (paid) {
      const cost = Number(settings.paidSpinCost || 20);
      paid.disabled = (w.available || 0) < cost || spinning;
      paid.innerHTML = `২০৳ ব্যালেন্স দিয়ে স্পিন করুন (Paid Spin)`.replace("২০", String(cost));
    }
  });
  drawWheel(settings.spinSegments);
  bindSpinButtons();
  loadLiveWins();
  loadMySpins();
  renderRules();
  await refreshSpinState();
}

/* ---------- চাকা আঁকা (Canvas) ---------- */
function drawWheel(segments) {
  const canvas = $("#wheelCanvas");
  if (!canvas || !Array.isArray(segments)) return;
  const size = 340;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2, cy = size / 2, r = size / 2 - 6;
  const n = segments.length;
  const arc = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a0 = i * arc - Math.PI / 2 - arc / 2;
    const a1 = a0 + arc;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = SEG_COLORS[i % SEG_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a0 + arc / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px 'Hind Siliguri', sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 4;
    ctx.fillText(String(segments[i].label || ""), r - 16, 6);
    ctx.restore();
  }
  // center hub
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  canvas.dataset.segments = n;
}

/* ---------- স্পিন ---------- */
function bindSpinButtons() {
  const freeBtn = $("#btn-free-spin");
  const paidBtn = $("#btn-paid-spin");
  if (freeBtn) freeBtn.addEventListener("click", () => doSpin("free", freeBtn));
  if (paidBtn) paidBtn.addEventListener("click", async () => {
    const { confirmDialog } = await import("./utils.js");
    const ok = await confirmDialog(`${money(settings.paidSpinCost)} ব্যালেন্স কাটা হয়ে স্পিন হবে। নিশ্চিত?`, "স্পিন করুন");
    if (ok) doSpin("paid", paidBtn);
  });
}

async function doSpin(type, btn) {
  if (spinning) return;
  spinning = true;
  const restore = btnLoading(btn);
  let result = null;
  try {
    // সার্ভার আগে সিদ্ধান্ত নেয় → তারপর অ্যানিমেশন
    result = await apiCall("spin", { type });
    await animateWheel(result.segmentIndex, result.segments);
    showWinModal(result);
    await refreshSpinState();
    loadMySpins();
    loadLiveWins();
  } catch (e) {
    toast(friendlyError(e), "error", 4200);
  } finally {
    spinning = false;
    restore();
  }
}

function animateWheel(targetIndex, segCount) {
  return new Promise((resolve) => {
    const canvas = $("#wheelCanvas");
    if (!canvas) return resolve();
    const n = segCount || Number(canvas.dataset.segments || 8);
    const arc = 360 / n;
    // টার্গেট সেগমেন্ট পয়েন্টারের (উপরের) নিচে আনতে ঘূর্ণন হিসাব
    const segCenter = targetIndex * arc;
    const jitter = (Math.random() - 0.5) * (arc * 0.5);
    const target = 360 * 6 - (segCenter + jitter);
    const start = performance.now();
    const dur = 4200;
    let from = 0;
    // আগের rotation মান রাখি dataset-এ
    from = Number(canvas.dataset.rot || 0);
    const total = from + (360 * 6) + (((target - from) % 360) + 360) % 360;
    function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4); // ease-out quartic
      const rot = from + (total - from) * eased;
      canvas.style.transform = `rotate(${rot}deg)`;
      if (p < 1) requestAnimationFrame(frame);
      else { canvas.dataset.rot = String(total % 360); resolve(); }
    }
    requestAnimationFrame(frame);
  });
}

function showWinModal(result) {
  const seg = result.segment || {};
  const isCash = seg.kind === "cash" && Number(seg.value) > 0;
  const isSpecial = seg.kind === "special";
  import("./utils.js").then(({ openModal }) => {
    openModal(`
      <div class="win-modal">
        <div class="modal-head"><h3>${isCash || isSpecial ? "🎉 অভিনন্দন!" : "🙏 ধন্যবাদ"}</h3><button class="modal-close">✕</button></div>
        <div class="wm-glow">${isCash ? "৳" : isSpecial ? "🎁" : "💫"}</div>
        <h3>${esc(String(seg.label || ""))}</h3>
        <p>${isCash ? `${money(seg.value)} আপনার ব্যালেন্সে যোগ হয়েছে!` : isSpecial ? "বিশেষ পুরস্কার — সাপোর্ট টিম যোগাযোগ করবে!" : "এবার হয়নি, আবার চেষ্টা করুন!"}</p>
        <button class="btn btn-primary mt-3" onclick="document.querySelector('.modal-backdrop').remove();document.body.style.overflow=''">ঠিক আছে</button>
      </div>`);
  });
}

async function refreshSpinState() {
  const stEl = $("#sp-free-left");
  const cdEl = $("#sp-cooldown");
  const freeBtn = $("#btn-free-spin");
  const invited = $("#sp-invited");
  try {
    const snap = await get(ref(db(), `spinState/${window.__WTE_UID__}`));
    const state = snap.exists() ? snap.val() : {};
    const today = new Date().toISOString().slice(0, 10);
    const usedToday = (state.daily && state.daily.date === today) ? Number(state.daily.count || 0) : 0;
    const freeLeft = Math.max(0, Number(settings.spinFreeDaily || 3) - usedToday);
    if (stEl) stEl.textContent = String(freeLeft);
    if (invited) {
      const prof = window.__WTE_PROFILE__ || {};
      const fSnap = await get(ref(db(), `referrals/${window.__WTE_UID__}`));
      invited.textContent = String(fSnap.exists() ? fSnap.size : 0);
    }
    // কুলডাউন
    let cdMsg = "";
    if (freeLeft <= 0) {
      cdMsg = "আজকের ফ্রি স্পিন শেষ — আগামীকাল আবার আসুন বা Paid Spin করুন";
    } else if (state.lastFreeAt) {
      const wait = Number(settings.spinCooldownMinutes || 120) * 60000 - (Date.now() - state.lastFreeAt);
      if (wait > 0) {
        const m = Math.ceil(wait / 60000);
        cdMsg = `পরবর্তী ফ্রি স্পিন: আরও ${m} মিনিট অপেক্ষা করুন`;
      }
    }
    if (cdEl) cdEl.textContent = cdMsg;
    if (freeBtn) {
      const disabled = freeLeft <= 0 || !!cdMsg || spinning;
      freeBtn.disabled = disabled;
      freeBtn.innerHTML = disabled && cdMsg ? `<span class="cooldown-timer">⏳ ${esc(cdMsg)}</span>` : `🎡 ফ্রি স্পিন করুন (${freeLeft} বাকি)`;
    }
  } catch (e) { console.warn("[spin state]", e.message); }
}

async function loadLiveWins() {
  const el = $("#live-wins");
  if (!el) return;
  try {
    const snap = await get(query(ref(db(), "liveWins"), orderByChild("at"), limitToLast(10)));
    const rows = [];
    snap.forEach((c) => rows.push(c.val()));
    rows.sort((a, b) => (b.at || 0) - (a.at || 0));
    el.innerHTML = rows.length ? rows.map((r) => `
      <div class="live-win"><span>📱 ${esc(r.maskedPhone || "01*****")}</span><span>স্পিন জিতেছেন</span><span class="lw-amt">${esc(String(r.label || ""))}</span></div>`).join("")
      : `<div class="live-win"><span>এখনও কোনো বিজয়ী নেই — আপনিই প্রথম হোন!</span></div>`;
  } catch { el.innerHTML = `<div class="live-win"><span>লাইভ তালিকা লোড করা যায়নি</span></div>`; }
}

async function loadMySpins() {
  const el = $("#my-spins");
  if (!el) return;
  try {
    const snap = await get(query(ref(db(), `spinHistory/${window.__WTE_UID__}`), orderByChild("at"), limitToLast(15)));
    const rows = [];
    snap.forEach((c) => rows.push(c.val()));
    rows.sort((a, b) => (b.at || 0) - (a.at || 0));
    el.innerHTML = rows.length ? rows.map((r) => `
      <div class="live-win"><span>🎡 ${fmtTime(r.at)}</span><span>${esc(r.type === "paid" ? "পেইড স্পিন" : "ফ্রি স্পিন")}</span><span class="lw-amt">${esc(String(r.label || "—"))}</span></div>`).join("")
      : `<div class="live-win"><span>এখনও কোনো স্পিন হয়নি</span></div>`;
  } catch { el.innerHTML = `<div class="live-win"><span>হিস্টোরি লোড করা যায়নি</span></div>`; }
}

function renderRules() {
  const el = $("#spin-rules");
  if (!el) return;
  const segs = (settings.spinSegments || []).map((s) => `<li><b>${esc(String(s.label))}</b> — ওজন ${esc(String(s.weight))}${s.kind === "cash" && s.value > 0 ? ` (${money(s.value)})` : ""}</li>`).join("");
  el.innerHTML = `
    <ul style="padding-left:18px">
      <li>প্রতিদিন <b>${esc(String(settings.spinFreeDaily))}টি ফ্রি স্পিন</b> পাওয়া যায়; প্রতি স্পিনের মাঝে <b>${esc(String(settings.spinCooldownMinutes))} মিনিট</b> কুলডাউন।</li>
      <li>পেইড স্পিন খরচ <b>${money(settings.paidSpinCost)}</b> — ব্যালেন্স থেকে সরাসরি কাটা হয়।</li>
      ${segs}
      <li>পুরস্কারের সিদ্ধান্ত সম্পূর্ণ <b>সার্ভার-সাইডে</b> হয় — ব্রাউজার পরিবর্তন করে জেতা সম্ভব নয়।</li>
      <li>আয়ের কোনো "নিশ্চয়তা" নেই — স্পিন বিনোদনমূলক বোনাস ফিচার।</li>
    </ul>`;
}
