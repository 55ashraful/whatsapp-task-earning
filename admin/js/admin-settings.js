/* admin-settings.js — প্ল্যাটফর্ম সেটিংস সম্পাদনা (server-side সেভ) */
import { ref, get } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getDb } from "../../src/js/firebase-config.js";
import { esc, money, toast, apiCall, friendlyError } from "../../src/js/utils.js";

export async function render(main) {
  const db = getDb();
  const snap = await get(ref(db, "settings"));
  const s = snap.exists() ? snap.val() : {};
  const pn = s.paymentNumbers || {};

  main.innerHTML = `
  <div class="a-card">
    <h3>⚙️ প্ল্যাটফর্ম সেটিংস</h3>
    <div class="a-note">সেভ করলে server-side যাচাই হয়ে settings নোড আপডেট হয় + অডিট লগ হয়।</div>
    <form id="settings-form">
      <div class="a-form-row c3">
        <div><label class="a-label">রেফারেল বোনাস (৳ / বন্ধু)</label><input class="a-input" type="number" id="st-refbonus" value="${esc(s.referralBonusPerFriend ?? 20)}" min="0" step="1"></div>
        <div><label class="a-label">রেফারেল ইনকাম %</label><input class="a-input" type="number" id="st-refpct" value="${esc(s.referIncomePercent ?? 5)}" min="0" max="50" step="1"></div>
        <div><label class="a-label">রেফারেল ট্রান্সফার মিনিমাম (৳)</label><input class="a-input" type="number" id="st-refmin" value="${esc(s.referTransferMin ?? 50)}" min="1" step="1"></div>
      </div>
      <div class="a-form-row c3">
        <div><label class="a-label">দৈনিক ফ্রি স্পিন</label><input class="a-input" type="number" id="st-spindaily" value="${esc(s.spinFreeDaily ?? 3)}" min="0" max="20" step="1"></div>
        <div><label class="a-label">স্পিন কুলডাউন (মিনিট)</label><input class="a-input" type="number" id="st-spincool" value="${esc(s.spinCooldownMinutes ?? 120)}" min="0" step="5"></div>
        <div><label class="a-label">পেইড স্পিন খরচ (৳)</label><input class="a-input" type="number" id="st-spincost" value="${esc(s.paidSpinCost ?? 20)}" min="1" step="1"></div>
      </div>
      <div class="a-form-row c3">
        <div><label class="a-label">সর্বনিম্ন ডিপোজিট (৳)</label><input class="a-input" type="number" id="st-mindep" value="${esc(s.minDeposit ?? 100)}" min="1" step="1"></div>
        <div><label class="a-label">সর্বনিম্ন উত্তোলন (৳)</label><input class="a-input" type="number" id="st-minwd" value="${esc(s.minWithdraw ?? 200)}" min="1" step="1"></div>
        <div><label class="a-label">সাপোর্ট WhatsApp</label><input class="a-input" id="st-supportwa" value="${esc(s.supportWhatsapp || "")}" placeholder="8801XXXXXXXXX"></div>
      </div>
      <div class="a-form-row c3">
        <div><label class="a-label">bKash নম্বর</label><input class="a-input" id="st-bkash" value="${esc(pn.bkash || "")}"></div>
        <div><label class="a-label">Nagad নম্বর</label><input class="a-input" id="st-nagad" value="${esc(pn.nagad || "")}"></div>
        <div><label class="a-label">Rocket নম্বর</label><input class="a-input" id="st-rocket" value="${esc(pn.rocket || "")}"></div>
      </div>
      <div class="a-form-row">
        <div><label class="a-label">টাস্ক ক্যাটাগরি (কমা দিয়ে আলাদা)</label><input class="a-input" id="st-cats" value="${esc((s.categories || ["whatsapp_status", "whatsapp_channel", "app_install", "social", "review", "other"]).join(", "))}"></div>
      </div>
      <div class="a-form-row">
        <div><label class="a-label">সিস্টেম ঘোষণা (প্রতি লাইন একটি ঘোষণা)</label>
        <textarea class="a-textarea" id="st-announce" rows="4">${esc((s.announcements || []).join("\n"))}</textarea></div>
      </div>
      <button type="submit" class="a-btn primary">💾 সেটিংস সেভ করুন</button>
    </form>
  </div>

  <div class="a-card">
    <h3>📢 সিস্টেম ব্রডকাস্ট (সব ইউজারের নোটিফিকেশনে)</h3>
    <form id="broadcast-form">
      <div class="a-form-row"><div>
        <label class="a-label">বার্তা</label>
        <textarea class="a-textarea" id="bc-msg" rows="3" placeholder="যেমন: আজ রাত ১২টা থেকে নতুন টাস্ক ব্যাচ যুক্ত হবে!"></textarea>
      </div></div>
      <button type="submit" class="a-btn primary">📤 ব্রডকাস্ট পাঠান</button>
      <p class="a-note mt-2" style="margin-top:10px">ব্রডকাস্ট সব ইউজারের notifications-এ চলে যায় — অপব্যবহার করবেন না (spammer-রা ব্লক হয়)।</p>
    </form>
  </div>`;

  main.querySelector("#settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      action: "updateSettings",
      settings: {
        referralBonusPerFriend: num("#st-refbonus", 20),
        referIncomePercent: num("#st-refpct", 5),
        referTransferMin: num("#st-refmin", 50),
        spinFreeDaily: num("#st-spindaily", 3),
        spinCooldownMinutes: num("#st-spincool", 120),
        paidSpinCost: num("#st-spincost", 20),
        minDeposit: num("#st-mindep", 100),
        minWithdraw: num("#st-minwd", 200),
        supportWhatsapp: val("#st-supportwa"),
        paymentNumbers: {
          bkash: val("#st-bkash").trim(),
          nagad: val("#st-nagad").trim(),
          rocket: val("#st-rocket").trim(),
        },
        categories: val("#st-cats").split(",").map((x) => x.trim()).filter(Boolean),
        announcements: val("#st-announce").split("\n").map((x) => x.trim()).filter(Boolean),
      },
    };
    try {
      await apiCall("admin", payload);
      toast("সেটিংস সেভ হয়েছে ✅", "success");
    } catch (err) { toast(friendlyError(err), "error", 5000); }
  });

  main.querySelector("#broadcast-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = main.querySelector("#bc-msg").value.trim();
    if (msg.length < 5) return toast("বার্তা খুব ছোট", "warn");
    try {
      await apiCall("admin", { action: "broadcast", message: msg });
      toast("ব্রডকাস্ট পাঠানো হয়েছে", "success");
      main.querySelector("#bc-msg").value = "";
    } catch (err) { toast(friendlyError(err), "error", 5000); }
  });

  function val(sel) { return main.querySelector(sel).value || ""; }
  function num(sel, dflt) { const n = Number(val(sel)); return Number.isFinite(n) ? n : dflt; }
}
