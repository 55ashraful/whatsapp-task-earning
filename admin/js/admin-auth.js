/* ============================================================
   admin-auth.js — Admin লগইন (Email/Password + Google)
   Bootstrap: /api/admin {action:'bootstrap'} — server ADMIN_EMAILS
   env দেখে শুধু অনুমোদিত ইমেইলকে role='admin' দেয়
   ============================================================ */
import { getAuthInstance } from "../../src/js/firebase-config.js";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { toast, friendlyError } from "../../src/js/utils.js";

export function bindAdminLogin() {
  const form = document.getElementById("a-form-login");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("a-login-error");
    errBox.classList.add("hidden");
    try {
      const auth = getAuthInstance();
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, document.getElementById("a-email").value.trim(), document.getElementById("a-password").value);
    } catch (err) {
      errBox.textContent = friendlyError(err);
      errBox.classList.remove("hidden");
    }
  });
  document.getElementById("a-google").addEventListener("click", async () => {
    const errBox = document.getElementById("a-login-error");
    try {
      const auth = getAuthInstance();
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (err) {
      errBox.textContent = friendlyError(err);
      errBox.classList.remove("hidden");
    }
  });
}

export async function tryBootstrapAdmin() {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) return { ok: false, error: "আগে ইমেইল/Google দিয়ে লগইন করুন" };
  try {
    const idToken = await user.getIdToken(true);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ action: "bootstrap" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `সার্ভার ত্রুটি (${res.status})` };
    setTimeout(() => location.reload(), 900);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

export { toast };
