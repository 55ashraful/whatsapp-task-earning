/* ============================================================
   whatsapp.js — নিরাপদ WhatsApp নম্বর বাইন্ডিং
   ------------------------------------------------------------
   ⚠ নিরাপত্তা নীতি: এই প্ল্যাটফর্ম ব্যবহারকারীর WhatsApp OTP,
   পাসওয়ার্ড বা ভেরিফিকেশন কোড কখনো সংগ্রহ করে না।
   শুধু প্রচারমূলক টাস্ক পেতে সম্মত নম্বর সংরক্ষণ করা হয়।
   বিস্তারিত: Terms ও Task Rules পেজ।
   ============================================================ */
import { $, esc, toast, v, markInvalid, btnLoading, friendlyError } from "./utils.js";
import { bindWhatsappNumber } from "./user.js";

export function bindWhatsappLinkPage() {
  const form = $("#form-wa-bind");
  if (!form) return;
  const prof = window.__WTE_PROFILE__ || {};
  const current = (prof.whatsapp || {}).number || "";
  const numEl = $("#wa-number");
  if (current) {
    $("#wa-current").classList.remove("hidden");
    $("#wa-current-num").textContent = current;
    form.classList.add("hidden");
    $("#wa-unbind").addEventListener("click", async () => {
      try {
        await bindWhatsappNumber(window.__WTE_UID__, "");
        toast("নম্বর সরানো হয়েছে", "success");
        setTimeout(() => location.reload(), 700);
      } catch (e) { toast(friendlyError(e), "error"); }
    });
    return;
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = numEl.value.trim().replace(/[\s-]/g, "").replace(/^\+?880/, "0");
    if (!v.phone(raw)) return markInvalid(numEl, "সঠিক ১১ ডিজিটের নম্বর দিন (যেমন 01712345678)");
    if (!$("#wa-consent").checked) return toast("সম্মতি চেকবক্সে টিক দিন", "warn");
    const restore = btnLoading($("#wa-submit"));
    try {
      await bindWhatsappNumber(window.__WTE_UID__, raw);
      toast("WhatsApp নম্বর যুক্ত হয়েছে ✅", "success");
      setTimeout(() => location.reload(), 800);
    } catch (err) { toast(friendlyError(err), "error"); }
    finally { restore(); }
  });
}
