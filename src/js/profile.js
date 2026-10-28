/* ============================================================
   profile.js — প্রোফাইল দেখা ও সম্পাদনা, রোল নির্বাচন (Google)
   ============================================================ */
import { $, $$, esc, toast, v, markInvalid, btnLoading, uploadImage, friendlyError, fmtDate } from "./utils.js";
import { updateOwnProfile, completeRoleSelection } from "./user.js";

export function bindProfilePage() {
  const root = $(".profile-page");
  if (!root) return;
  const prof = window.__WTE_PROFILE__ || {};
  const user = window.__WTE_AUTHUSER__ || {};

  $("#pf-name").textContent = prof.displayName || "—";
  $("#pf-email").textContent = prof.email || user.email || "—";
  $("#pf-uid").textContent = prof.uid || user.uid || "—";
  $("#pf-role").textContent = prof.role === "buyer" ? "Buyer (টাস্ক প্রদানকারী)" : prof.role === "worker" ? "Worker (কাজ করার ইচ্ছুক)" : prof.role === "admin" ? "Admin" : "নির্ধারিত হয়নি";
  $("#pf-since").textContent = fmtDate(prof.createdAt || Date.now());
  $("#pf-refcode").textContent = prof.referralCode || "—";
  $("#pf-status").textContent = prof.status === "blocked" ? "⛔ ব্লকড" : "✅ সক্রিয়";
  $("#pf-status").className = `chip ${prof.status === "blocked" ? "red" : "green"}`;
  $("#pf-avatar").textContent = (prof.displayName || "U").charAt(0).toUpperCase();
  if (prof.photoURL) $("#pf-avatar").innerHTML = `<img src="${esc(prof.photoURL)}" alt="avatar" onerror="this.parentNode.textContent='U'">`;

  // blocked ইউজার: শুধু দেখা যাবে, এডিট নয়
  if (prof.status === "blocked") {
    $("#pf-form").classList.add("hidden");
    $("#pf-blocked-note").classList.remove("hidden");
    return;
  }

  // ---- রোল নির্বাচন (Google first-login: role === 'pending') ----
  if (prof.role === "pending") {
    $("#pf-role-pick").classList.remove("hidden");
    $("#pf-role-save").addEventListener("click", async () => {
      const sel = $$("input[name='pf-role']:checked")[0];
      if (!sel) return toast("ভূমিকা নির্বাচন করুন", "warn");
      const restore = btnLoading($("#pf-role-save"));
      try {
        await completeRoleSelection(prof.uid, sel.value);
        toast("ভূমিকা সংরক্ষিত হয়েছে", "success");
        setTimeout(() => location.reload(), 700);
      } catch (e) { toast(friendlyError(e), "error"); restore(); }
    });
  }

  // ---- এডিট ফর্ম প্রি-ফিল ----
  $("#edit-name").value = prof.displayName || "";
  $("#edit-photo").value = prof.photoURL || "";

  const upBtn = $("#edit-photo-upload");
  if (upBtn) upBtn.addEventListener("click", async () => {
    const f = $("#edit-photo-file").files[0];
    if (!f) return toast("আগে ছবি নির্বাচন করুন", "warn");
    const restore = btnLoading(upBtn);
    try {
      const url = await uploadImage(f);
      $("#edit-photo").value = url;
      toast("ছবি আপলোড হয়েছে ✓ — সেভ করুন", "success");
    } catch (e) { toast(friendlyError(e), "error"); }
    finally { restore(); }
  });

  $("#form-profile").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#edit-name").value.trim();
    const photo = $("#edit-photo").value.trim();
    if (!v.name(name)) return markInvalid($("#edit-name"), "নাম কমপক্ষে ৩ অক্ষরের দিন");
    if (photo && !v.url(photo)) return markInvalid($("#edit-photo"), "ছবির URL সঠিক নয় (http/https)");
    const restore = btnLoading($("#pf-save"));
    try {
      await updateOwnProfile(prof.uid, { displayName: name, photoURL: photo });
      toast("প্রোফাইল আপডেট হয়েছে ✓", "success");
      setTimeout(() => location.reload(), 700);
    } catch (err) { toast(friendlyError(err), "error"); }
    finally { restore(); }
  });
}
