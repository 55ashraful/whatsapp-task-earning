/* ============================================================
   auth.js — লগইন / রেজিস্ট্রেশন / Google / পাসওয়ার্ড রিসেট
   ============================================================ */
import { getAuthInstance } from "./firebase-config.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { $, $$, esc, toast, v, markInvalid, btnLoading, friendlyError, genReferralCode } from "./utils.js";
import { navigate } from "./router.js";
import { completeRoleSelection } from "./user.js";

let hooks = { onAuthSuccess: () => {} };
export function registerAuthListeners(h) { hooks = { ...hooks, ...h }; }

const AUTH_PAGE_IDS = ["page-login", "page-register", "page-reset"];

function isAuthPage() { return AUTH_PAGE_IDS.some((id) => document.getElementById(id)); }

/* ---------- Login ---------- */
export function bindLoginPage() {
  const form = $("#form-login");
  if (!form) return;
  const { /* emailEl */ } = {};
  const emailEl = $("#login-email"), pwEl = $("#login-password");

  const pwToggle = $(".pw-toggle", form);
  if (pwToggle) pwToggle.addEventListener("click", () => {
    pwEl.type = pwEl.type === "password" ? "text" : "password";
    pwToggle.textContent = pwEl.type === "password" ? "🙈" : "🐵";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailEl.value.trim();
    const pw = pwEl.value;
    if (!v.email(email)) return markInvalid(emailEl, "সঠিক ইমেইল দিন");
    if (!pw || pw.length < 6) return markInvalid(pwEl, "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর");
    const restore = btnLoading($("#login-submit"));
    try {
      const auth = getAuthInstance();
      await setPersistence(auth, browserLocalPersistence);
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      await ensureBlockedCheck(cred.user.uid);
      hooks.onAuthSuccess();
      navigate("/home");
    } catch (err) {
      console.warn("[login]", err.code);
      toast(friendlyError(err), "error");
    } finally { restore(); }
  });

  const gBtn = $("#login-google");
  if (gBtn) gBtn.addEventListener("click", () => doGoogleLogin(gBtn));

  const forgot = $("#forgot-link");
  if (forgot) forgot.addEventListener("click", (e) => { e.preventDefault(); navigate("/reset"); });
}

/* ---------- Register ---------- */
export function bindRegisterPage() {
  const form = $("#form-register");
  if (!form) return;
  const nameEl = $("#reg-name"), emailEl = $("#reg-email"), pwEl = $("#reg-password"),
        pw2El = $("#reg-password2"), codeEl = $("#reg-refcode");

  const pwToggle = $(".pw-toggle", form);
  if (pwToggle) pwToggle.addEventListener("click", () => {
    pwEl.type = pwEl.type === "password" ? "text" : "password";
    pwToggle.textContent = pwEl.type === "password" ? "🙈" : "🐵";
  });

  // URL-এ ?ref=CODE থাকলে প্রি-ফিল (hash query: #/register?ref=CODE)
  const hash = location.hash || "";
  const m = hash.match(/[?&]ref=([A-Za-z0-9]{4,10})/);
  if (m && codeEl && !codeEl.value) codeEl.value = m[1].toUpperCase();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const pw = pwEl.value, pw2 = pw2El.value;
    const role = ($$('input[name="role"]:checked', form) || [])[0];
    const refCode = (codeEl.value || "").trim().toUpperCase();

    if (!v.name(name)) return markInvalid(nameEl, "নাম কমপক্ষে ৩ অক্ষরের দিন");
    if (!v.email(email)) return markInvalid(emailEl, "সঠিক ইমেইল দিন");
    if (pw.length < 6) return markInvalid(pwEl, "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর");
    if (pw !== pw2) return markInvalid(pw2El, "দুটি পাসওয়ার্ড মিলছে না");
    if (!role) return toast("ভূমিকা (Buyer/Worker) নির্বাচন করুন", "warn");
    if (refCode && !v.code(refCode)) return markInvalid(codeEl, "রেফারেল কোডের ফরম্যাট ভুল");

    const restore = btnLoading($("#register-submit"));
    try {
      const auth = getAuthInstance();
      await setPersistence(auth, browserLocalPersistence);
      // রেফারেল কোড আগে যাচাই (rules-ও যাচাই করবে)
      const db = getDbSafe();
      let referredBy = "";
      if (refCode) {
        const snap = await get(ref(db, `referralCodes/${refCode}`));
        if (!snap.exists()) throw new Error("রেফারেল কোডটি সঠিক নয়");
        referredBy = snap.val();
      }
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      // প্রোফাইল তৈরি (rules: শুধু নিজের নোড, গঠন যাচাইকৃত)
      const code = genReferralCode();
      const { serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js");
      const updates = {};
      updates[`users/${cred.user.uid}`] = {
        uid: cred.user.uid,
        displayName: name,
        email,
        photoURL: "",
        role: role.value,
        status: "active",
        createdAt: serverTimestamp(),
        referralCode: code,
        referredBy,
        whatsapp: { number: "", linkedAt: 0 },
        language: localStorage.getItem("wte_lang") || "bn",
      };
      updates[`referralCodes/${code}`] = cred.user.uid;
      if (referredBy && referredBy !== cred.user.uid) {
        updates[`referrals/${referredBy}/${cred.user.uid}`] = {
          uid: cred.user.uid, displayName: name, joinedAt: serverTimestamp(),
        };
      }
      await update(ref(db), updates);
      hooks.onAuthSuccess();
      toast("অ্যাকাউন্ট তৈরি সফল! স্বাগতম 🎉", "success");
      navigate("/home");
    } catch (err) {
      console.warn("[register]", err.code);
      toast(friendlyError(err), "error");
    } finally { restore(); }
  });

  const gBtn = $("#register-google");
  if (gBtn) gBtn.addEventListener("click", () => doGoogleLogin(gBtn));
}

/* ---------- Reset ---------- */
export function bindResetPage() {
  const form = $("#form-reset");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailEl = $("#reset-email");
    const email = emailEl.value.trim();
    if (!v.email(email)) return markInvalid(emailEl, "সঠিক ইমেইল দিন");
    const restore = btnLoading($("#reset-submit"));
    try {
      await sendPasswordResetEmail(getAuthInstance(), email);
      toast("রিসেট লিংক পাঠানো হয়েছে — ইমেইল দেখুন", "success");
      navigate("/login");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally { restore(); }
  });
}

/* ---------- Google ---------- */
async function doGoogleLogin(btn) {
  const restore = btnLoading(btn);
  try {
    const auth = getAuthInstance();
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    await ensureBlockedCheck(cred.user.uid);
    // প্রোফাইল নেই বা role pending হলে রোল নির্বাচন মডাল
    await maybeAskRole(cred.user.uid);
    hooks.onAuthSuccess();
    navigate("/home");
  } catch (err) {
    console.warn("[google]", err.code);
    toast(friendlyError(err), "error");
  } finally { restore(); }
}

function getDbSafe() {
  // circular import এড়াতে এখানে lazy
  const cfg = window.__WTE_DB__;
  if (!cfg) throw new Error("Database প্রস্তুত নয় — পেজ রিফ্রেশ করুন");
  return cfg;
}
export function setDbRef(db) { window.__WTE_DB__ = db; }

async function ensureBlockedCheck(uid) {
  try {
    const db = getDbSafe();
    const snap = await get(ref(db, `users/${uid}/status`));
    if (snap.exists() && snap.val() === "blocked") {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");
      await signOut(getAuthInstance());
      toast("আপনার অ্যাকাউন্ট ব্লক করা হয়েছে — সাপোর্টে যোগাযোগ করুন", "error", 5000);
      throw new Error("blocked");
    }
  } catch (e) {
    if (e.message === "blocked") throw e;
    console.warn("[blocked check]", e.message); // DB না থাকলে থেমে যাবে না
  }
}

async function maybeAskRole(uid) {
  const db = getDbSafe();
  const snap = await get(ref(db, `users/${uid}/role`));
  const role = snap.exists() ? snap.val() : null;
  if (role === "buyer" || role === "worker") return;
  await new Promise((resolve) => {
    const bd = document.createElement("div");
    bd.className = "modal-backdrop";
    bd.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>আপনার ভূমিকা নির্বাচন করুন</h3></div>
        <p class="muted mb-2">আপনি কীভাবে ব্যবহার করতে চান? (পরে Profile থেকে পরিবর্তন করা যাবে না — সাপোর্টে যোগাযোগ করুন)</p>
        <div class="role-pick">
          <label><input type="radio" name="grole" value="buyer" class="hidden"><div class="role-card"><div class="rc-ico">🧑‍💼</div><div class="rc-t">Buyer</div><div class="rc-d">টাস্ক তৈরি করবেন</div></div></label>
          <label><input type="radio" name="grole" value="worker" class="hidden"><div class="role-card"><div class="rc-ico">🛠️</div><div class="rc-t">Worker</div><div class="rc-d">কাজ করে আয় করবেন</div></div></label>
        </div>
        <button class="btn btn-primary mt-3" id="grole-ok">নিশ্চিত করুন</button>
      </div>`;
    document.body.appendChild(bd);
    document.body.style.overflow = "hidden";
    bd.addEventListener("change", () => {
      $$("input[name='grole']", bd).forEach((r) => {
        $(".role-card", r.parentElement).style.borderColor = r.checked ? "var(--primary)" : "";
        $(".role-card", r.parentElement).style.background = r.checked ? "var(--primary-light)" : "";
      });
    });
    $("#grole-ok", bd).addEventListener("click", async () => {
      const sel = $$("input[name='grole']:checked", bd)[0];
      if (!sel) return toast("ভূমিকা নির্বাচন করুন", "warn");
      try {
        await completeRoleSelection(uid, sel.value);
        bd.remove(); document.body.style.overflow = "";
        toast("ভূমিকা সংরক্ষিত হয়েছে", "success");
        resolve();
      } catch (e) { toast(e.message, "error"); }
    });
  });
}

/* সব auth পেজ একসাথে bind করার হেল্পার */
export function bindAllAuthPages() {
  bindLoginPage(); bindRegisterPage(); bindResetPage();
}
