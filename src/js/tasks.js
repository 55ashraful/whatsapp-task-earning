/* ============================================================
   tasks.js — টাস্ক তালিকা, বিস্তারিত, Worker অংশগ্রহণ/জমা,
              Buyer টাস্ক তৈরি ও ব্যবস্থাপনা
   নিরাপত্তা: বাজেট reserve / পুরস্কার ক্রেডিট সব serverless API-তে
   (client শুধু অ্যাসাইনমেন্ট ও submission লিখতে পারে — rules যাচাই করে)
   ============================================================ */
import { ref, get, update, push, query, orderByChild, equalTo, limitToLast } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { $, $$, el, esc, toast, showLoading, v, markInvalid, btnLoading, money, fmtTime, confirmDialog, apiCall, uploadImage, friendlyError } from "./utils.js";
import { fetchSettings } from "./user.js";

function db() { return window.__WTE_DB__; }
function uid() { return window.__WTE_UID__; }

const CAT_META = {
  whatsapp_status: { label: "WhatsApp স্ট্যাটাস", ico: "💬" },
  whatsapp_channel: { label: "WhatsApp চ্যানেল", ico: "📢" },
  app_install: { label: "অ্যাপ ইনস্টল", ico: "📲" },
  social: { label: "সোশ্যাল মিডিয়া", ico: "🌐" },
  review: { label: "রিভিউ / ফিডব্যাক", ico: "⭐" },
  other: { label: "অন্যান্য", ico: "📦" },
};
export function catMeta(key) { return CAT_META[key] || CAT_META.other; }

/* ================= Worker: টাস্ক তালিকা ================= */
export async function bindTasksPage() {
  const listEl = $("#task-list");
  if (!listEl) return;
  const settings = await fetchSettings();
  renderCatGrid(settings.categories);
  const refreshBtn = $("#tasks-refresh");
  if (refreshBtn) refreshBtn.addEventListener("click", () => { fragmentCacheClear(); location.reload(); });
  function fragmentCacheClear() { /* full reload handles cache */ }

  let activeCat = "all";
  let allTasks = [];

  await loadTasks();

  async function loadTasks() {
    showLoading(listEl, "টাস্ক লোড হচ্ছে...");
    try {
      const snap = await get(query(ref(db(), "tasks"), orderByChild("status"), equalTo("active"), limitToLast(100)));
      allTasks = [];
      snap.forEach((c) => allTasks.push({ id: c.key, ...c.val() }));
      allTasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      // স্লট গণনা taskAssignments থেকে (rules-safe)
      await Promise.all(allTasks.map(async (tk) => {
        try {
          const aSnap = await get(ref(db(), `taskAssignments/${tk.id}`));
          tk.filled = aSnap.exists() ? aSnap.size : 0;
        } catch { tk.filled = 0; }
      }));
      render();
    } catch (e) {
      console.error(e);
      listEl.innerHTML = `<div class="empty-state"><div class="ico">⚠️</div><h4>লোড করা যায়নি</h4><p>${esc(friendlyError(e))}</p></div>`;
    }
  }

  function renderCatGrid(cats) {
    const grid = $("#cat-grid");
    if (!grid) return;
    const items = [{ key: "all", label: "সব", ico: "🗂️" }, ...cats.map((c) => ({ key: c, ...catMeta(c) }))];
    grid.innerHTML = items.map((c) => `
      <button class="cat-item ${c.key === "all" ? "on" : ""}" data-cat="${esc(c.key)}">
        <span class="ci">${c.ico}</span>${esc(c.label)}
      </button>`).join("");
    $$(".cat-item", grid).forEach((b) => b.addEventListener("click", () => {
      activeCat = b.getAttribute("data-cat");
      $$(".cat-item", grid).forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      render();
    }));
  }

  function render() {
    const myId = uid();
    const tasks = allTasks.filter((tk) => activeCat === "all" || tk.category === activeCat);
    if (!tasks.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="ico">📭</div><h4>এখনও কোনো টাস্ক নেই</h4><p>নতুন টাস্ক যোগ হলে এখানে দেখতে পাবেন</p></div>`;
      return;
    }
    listEl.innerHTML = tasks.map((tk) => {
      const remaining = Math.max(0, (tk.slots || 0) - (tk.filled || 0));
      const mine = tk.buyerId === myId;
      const full = remaining <= 0;
      return `
      <div class="task-card">
        <div class="tc-top">
          <div class="tc-title">${esc(tk.title)}</div>
          <span class="chip tc-cat">${catMeta(tk.category).ico} ${esc(catMeta(tk.category).label)}</span>
        </div>
        <div class="tc-desc">${esc(tk.description || "")}</div>
        <div class="tc-meta">
          <span>💰 <b>${money(tk.reward)}</b>/কাজ</span>
          <span>⏳ সময়সীমা: <b>${tk.deadlineHours || 24} ঘণ্টা</b></span>
          <span>🛡️ Buyer: <b>${esc(tk.buyerName || "গোপন")}</b></span>
        </div>
        <div class="tc-foot">
          <div class="slot-bar">
            <div class="sb-txt"><span>স্লট</span><span>${tk.filled || 0}/${tk.slots}</span></div>
            <div class="progress"><span class="${full ? "full" : ""}" style="width:${Math.min(100, ((tk.filled || 0) / (tk.slots || 1)) * 100)}%"></span></div>
          </div>
          ${mine ? `<a class="btn btn-ghost btn-sm" href="#/task-details?id=${tk.id}">দেখুন</a>`
        : full ? `<span class="chip red">পূর্ণ</span>`
        : `<a class="btn btn-primary btn-sm" href="#/task-details?id=${tk.id}">শুরু করুন</a>`}
        </div>
      </div>`;
    }).join("");
  }
}

/* ================= Worker/Buyer: টাস্ক বিস্তারিত ================= */
export async function bindTaskDetailsPage(query) {
  const root = $(".task-details");
  if (!root || !query.id) { location.hash = "#/tasks"; return; }
  showLoading(root, "টাস্ক লোড হচ্ছে...");
  let task;
  try {
    const snap = await get(ref(db(), `tasks/${query.id}`));
    if (!snap.exists()) { root.innerHTML = emptyBox("টাস্কটি খুঁজে পাওয়া যায়নি"); return; }
    task = { id: snap.key, ...snap.val() };
  } catch (e) { root.innerHTML = emptyBox(friendlyError(e)); return; }

  const myId = uid();
  const isBuyer = task.buyerId === myId;
  let assignmentCount = 0;
  try {
    const aSnap = await get(ref(db(), `taskAssignments/${task.id}`));
    assignmentCount = aSnap.exists() ? aSnap.size : 0;
  } catch {}
  const remaining = Math.max(0, (task.slots || 0) - assignmentCount);
  const prof = window.__WTE_PROFILE__ || {};

  // আমার অ্যাসাইনমেন্ট আছে কি?
  let myAssignment = null;
  try {
    const asnap = await get(ref(db(), `taskAssignments/${task.id}/${myId}`));
    if (asnap.exists()) myAssignment = asnap.val();
  } catch {}

  // আমার submission আছে কি?
  let mySubmission = null;
  try {
    const ssnap = await get(query(ref(db(), "submissions"), orderByChild("taskId_workerId"), equalTo(`${task.id}_${myId}`), limitToLast(1)));
    ssnap.forEach((c) => { mySubmission = { id: c.key, ...c.val() }; });
  } catch {}

  const proofTypes = { text: "লিখিত বিবরণ", image: "স্ক্রিনশট/ছবি", both: "লিখিত + স্ক্রিনশট" };
  root.innerHTML = `
    <div class="back-row"><a href="#/tasks">← সব টাস্ক</a></div>
    <div class="td-hero">
      ${task.imageUrl ? `<img src="${esc(task.imageUrl)}" alt="task image" onerror="this.style.display='none'">` : ""}
      <div class="td-price">
        <div><div class="muted small">প্রতি কাজের পুরস্কার</div><div class="reward-tag" style="font-size:22px">${money(task.reward)}</div></div>
        <span class="status-pill ${esc(task.status)}">${statusBn(task.status)}</span>
      </div>
    </div>

    <div class="card td-section">
      <h3 class="card-title mb-2">${esc(task.title)}</h3>
      <div class="kv-list">
        <div class="kv"><span class="k">ক্যাটাগরি</span><span class="v">${catMeta(task.category).ico} ${esc(catMeta(task.category).label)}</span></div>
        <div class="kv"><span class="k">অবশিষ্ট স্লট</span><span class="v">${remaining} / ${task.slots}</span></div>
        <div class="kv"><span class="k">জমা দেওয়ার সময়সীমা</span><span class="v">${task.deadlineHours || 24} ঘণ্টা</span></div>
        <div class="kv"><span class="k">প্রমাণ জমার ধরন</span><span class="v">${esc(proofTypes[task.proofType] || task.proofType)}</span></div>
        <div class="kv"><span class="k">প্রকাশের সময়</span><span class="v">${fmtTime(task.createdAt)}</span></div>
        <div class="kv"><span class="k">Buyer</span><span class="v">${esc(task.buyerName || "গোপন")}</span></div>
      </div>
    </div>

    <div class="card td-section">
      <h3 class="card-title">করণীয় নির্দেশনা</h3>
      <div class="td-body">${esc(task.description || "—")}</div>
    </div>
    ${task.rules ? `<div class="card td-section"><h3 class="card-title">নিয়ম ও শর্ত</h3><div class="td-body">${esc(task.rules)}</div></div>` : ""}
    <div class="td-section" id="action-zone"></div>`;

  const zone = $("#action-zone", root);

  /* ----- Buyer view ----- */
  if (isBuyer) {
    zone.innerHTML = `
      <div class="card">
        <h3 class="card-title mb-2">Buyer নিয়ন্ত্রণ</h3>
        <div class="grid-2">
          <a class="btn btn-outline" href="#/submissions?task=${task.id}">জমা রিভিউ করুন</a>
          <button class="btn btn-danger" id="cancel-task" ${["cancelled", "completed", "blocked"].includes(task.status) ? "disabled" : ""}>টাস্ক বাতিল ও রিফান্ড</button>
        </div>
        <p class="hint mt-2">⚠️ বাতিল করলে অব্যবহৃত reserve বাজেট আপনার ব্যালেন্সে ফেরত যাবে; অনুমোদিত পুরস্কার চূড়ান্ত।</p>
      </div>`;
    const cbtn = $("#cancel-task", zone);
    if (cbtn) cbtn.addEventListener("click", async () => {
      const ok = await confirmDialog("টাস্কটি বাতিল করতে চান? অব্যবহৃত বাজেট ফেরত পাবেন।", "বাতিল করুন");
      if (!ok) return;
      const restore = btnLoading(cbtn);
      try {
        await apiCall("task", { action: "cancel", taskId: task.id });
        toast("টাস্ক বাতিল হয়েছে, রিফান্ড প্রসেস হয়েছে", "success");
        setTimeout(() => location.reload(), 900);
      } catch (e) { toast(friendlyError(e), "error"); restore(); }
    });
    return;
  }

  /* ----- Worker view ----- */
  if (["cancelled", "blocked", "completed"].includes(task.status)) {
    zone.innerHTML = `<div class="alert alert-warn">এই টাস্কটি ${statusBn(task.status)} — নতুন কাজ নেওয়া যাচ্ছে না।</div>`;
    return;
  }
  if (prof.status === "blocked") {
    zone.innerHTML = `<div class="alert alert-error">আপনার অ্যাকাউন্ট ব্লকড — কাজ নেওয়া যাবে না।</div>`;
    return;
  }
  if (prof.role !== "worker") {
    zone.innerHTML = `<div class="alert alert-info">কাজ করে আয় করতে Worker অ্যাকাউন্ট প্রয়োজন। আপনার বর্তমান ভূমিকা: <b>Buyer</b></div>`;
    return;
  }

  if (mySubmission) {
    zone.innerHTML = `
      <div class="card">
        <h3 class="card-title mb-2">আপনার জমা</h3>
        <span class="status-pill ${esc(mySubmission.status)}">${statusBn(mySubmission.status)}</span>
        ${mySubmission.status === "rejected" && mySubmission.rejectReason ? `<div class="reason-box">কারণ: ${esc(mySubmission.rejectReason)}</div>` : ""}
        ${mySubmission.status === "approved" ? `<div class="alert alert-success mt-2">পুরস্কার ${money(task.reward)} আপনার ওয়ালেটে যোগ হয়েছে ✅</div>` : ""}
        ${mySubmission.status === "pending" ? `<div class="alert alert-info mt-2">Buyer-এর রিভিউ অপেক্ষমাণ…</div>` : ""}
        ${mySubmission.status === "rejected" && remaining > 0 ? `<button class="btn btn-primary mt-2" id="redo-task">আবার চেষ্টা করুন</button>` : ""}
      </div>`;
    const redo = $("#redo-task", zone);
    if (redo) redo.addEventListener("click", () => startAssignment(redo));
    return;
  }

  if (!myAssignment) {
    if (remaining <= 0) {
      zone.innerHTML = `<div class="alert alert-warn">টাস্কটি পূর্ণ হয়ে গেছে — নতুন স্লট নেই।</div>`;
      return;
    }
    zone.innerHTML = `<button class="btn btn-success btn-lg" id="start-task">টাস্ক শুরু করুন (${money(task.reward)})</button>
      <p class="hint mt-2">শুরু করলে একটি স্লট আপনার নামে সংরক্ষিত হবে — নির্দেশনা অনুসরণ করে প্রমাণ জমা দিন।</p>`;
    $("#start-task", zone).addEventListener("click", (e) => startAssignment(e.currentTarget));
  } else if (myAssignment.status === "in_progress") {
    renderSubmitForm();
  } else {
    zone.innerHTML = `<div class="alert alert-info">অ্যাসাইনমেন্ট অবস্থা: ${statusBn(myAssignment.status)}</div>`;
  }

  async function startAssignment(btn) {
    const restore = btnLoading(btn);
    try {
      // assignment তৈরি (rules: task active + worker role + একবারই)
      await set(ref(db(), `taskAssignments/${task.id}/${myId}`), {
        taskId: task.id, workerId: myId,
        status: "in_progress", assignedAt: Date.now(),
      });
      toast("স্লট সংরক্ষিত হয়েছে! এখন কাজ করে প্রমাণ জমা দিন", "success");
      myAssignment = { status: "in_progress" };
      renderSubmitForm();
    } catch (e) {
      toast(friendlyError(e), "error");
      restore();
    }
  }

  function renderSubmitForm() {
    zone.innerHTML = `
      <div class="card">
        <h3 class="card-title mb-2">প্রমাণ জমা দিন</h3>
        <div class="alert alert-info">নির্দেশনা পূর্ণ করার প্রমাণ দিন। ভুয়া প্রমাণ দিলে অ্যাকাউন্ট ব্লক হতে পারে।</div>
        ${["image", "both"].includes(task.proofType) ? `
        <div class="form-group">
          <label>স্ক্রিনশট / ছবি ${task.proofType === "both" ? "" : "(আবশ্যক)"}</label>
          <div class="row">
            <input type="file" id="proof-file" accept="image/jpeg,image/png,image/webp,image/gif" class="form-control" style="padding:9px">
            <button type="button" class="btn btn-ghost btn-sm" id="proof-upload" style="flex-shrink:0">আপলোড</button>
          </div>
          <input type="url" id="proof-url" class="form-control mt-1" placeholder="অথবা ছবির URL বসান">
          <div class="hint">ImgBB-তে নিরাপদ server-side proxy দিয়ে আপলোড হয়</div>
        </div>` : ""}
        ${["text", "both"].includes(task.proofType) ? `
        <div class="form-group">
          <label>লিখিত বিবরণ ${task.proofType === "both" ? "" : "(আবশ্যক)"}</label>
          <textarea id="proof-text" class="form-control" placeholder="যা যা করেছেন সংক্ষেপে লিখুন..."></textarea>
        </div>` : ""}
        <div class="form-group">
          <label>রেফারেন্স (লিংক/আইডি) — ঐচ্ছিক</label>
          <input type="text" id="proof-ref" class="form-control" placeholder="প্রযোজ্য হলে লিংক বা আইডি">
        </div>
        <button class="btn btn-success" id="submit-proof">জমা দিন</button>
      </div>`;

    const upBtn = $("#proof-upload", zone);
    if (upBtn) upBtn.addEventListener("click", async () => {
      const f = $("#proof-file", zone).files[0];
      if (!f) return toast("আগে ছবি নির্বাচন করুন", "warn");
      const restore = btnLoading(upBtn);
      try {
        const url = await uploadImage(f);
        $("#proof-url", zone).value = url;
        toast("ছবি আপলোড হয়েছে ✓", "success");
      } catch (e) { toast(friendlyError(e), "error"); }
      finally { restore(); }
    });

    $("#submit-proof", zone).addEventListener("click", async (e) => {
      const urlEl = $("#proof-url", zone), textEl = $("#proof-text", zone), refEl = $("#proof-ref", zone);
      const url = (urlEl ? urlEl.value.trim() : "");
      const text = (textEl ? textEl.value.trim() : "");
      const needsImg = ["image", "both"].includes(task.proofType);
      const needsTxt = ["text", "both"].includes(task.proofType);
      if (needsImg && !url) return markInvalid(urlEl || e.currentTarget, "স্ক্রিনশট আবশ্যক");
      if (needsImg && url && !v.url(url)) return markInvalid(urlEl, "সঠিক URL দিন (http/https)");
      if (needsTxt && text.length < 10) return markInvalid(textEl || e.currentTarget, "কমপক্ষে ১০ অক্ষরের বিবরণ লিখুন");
      const restore = btnLoading(e.currentTarget);
      try {
        const subRef = push(ref(db(), `submissions/${task.id}`));
        const submission = {
          taskId: task.id, taskTitle: task.title,
          workerId: myId, workerName: prof.displayName || "Worker", buyerId: task.buyerId,
          proofUrl: url || "", proofText: text, reference: (refEl ? refEl.value.trim() : ""),
          reward: task.reward, currency: "BDT",
          taskId_workerId: `${task.id}_${myId}`,
          status: "pending", createdAt: Date.now(), reviewedAt: 0, rejectReason: "",
        };
        const updates = {};
        updates[`submissions/${task.id}/${subRef.key}`] = submission;
        // worker-এর হিস্টোরি mirror (rules: শুধু নিজের নোডে লেখা যায়)
        updates[`userSubmissions/${myId}/${subRef.key}`] = {
          taskId: task.id, taskId_subId: `${task.id}__${subRef.key}`,
          taskTitle: task.title, proofUrl: url || "", proofText: text,
          reward: task.reward, status: "pending",
          createdAt: Date.now(), reviewedAt: 0, rejectReason: "",
        };
        // assignment → submitted (ডুপ্লিকেট জমা প্রতিরোধের লক)
        updates[`taskAssignments/${task.id}/${myId}/status`] = "submitted";
        await update(ref(db()), updates);
        toast("জমা সফল! Buyer রিভিউ করার পর পুরস্কার পাবেন", "success");
        setTimeout(() => location.reload(), 900);
      } catch (err2) {
        toast(friendlyError(err2), "error");
        restore();
      }
    });
  }
}

/* ================= Buyer: টাস্ক তৈরি ================= */
export async function bindCreateTaskPage() {
  const form = $("#form-create-task");
  if (!form) return;
  const settings = await fetchSettings();
  const prof = window.__WTE_PROFILE__ || {};
  const catSel = $("#ct-category");
  catSel.innerHTML = settings.categories.map((c) => `<option value="${esc(c)}">${catMeta(c).ico} ${esc(catMeta(c).label)}</option>`).join("");

  const rewardEl = $("#ct-reward"), slotsEl = $("#ct-slots");
  function updateCost() {
    const r = Number(rewardEl.value) || 0, s = Number(slotsEl.value) || 0;
    const total = r * s;
    $("#cp-reward").textContent = money(r);
    $("#cp-slots").textContent = String(s);
    $("#cp-total").textContent = money(total);
    const balance = Number((window.__WTE_WALLET__ || {}).available || 0);
    const warn = $("#ct-balance-warn");
    if (warn) {
      warn.classList.toggle("hidden", total <= 0 || balance >= total);
      warn.textContent = `⚠️ পর্যাপ্ত ব্যালেন্স নেই — উত্তোলনযোগ্য ${money(balance)}, প্রয়োজন ${money(total)}`;
    }
  }
  rewardEl.addEventListener("input", updateCost);
  slotsEl.addEventListener("input", updateCost);
  const balEl = $("#cp-balance");
  if (balEl) balEl.textContent = money(Number((window.__WTE_WALLET__ || {}).available || 0));
  updateCost();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("#ct-title").value.trim();
    const desc = $("#ct-desc").value.trim();
    const rules = $("#ct-rules").value.trim();
    const reward = Number(rewardEl.value);
    const slots = Number(slotsEl.value);
    const deadlineHours = Number($("#ct-deadline").value) || 24;
    const proofType = $("#ct-proof").value;
    const category = catSel.value;
    const imageUrl = ($("#ct-image").value || "").trim();

    if (title.length < 8 || title.length > 90) return markInvalid($("#ct-title"), "শিরোনাম ৮-৯০ অক্ষরের দিন");
    if (desc.length < 20) return markInvalid($("#ct-desc"), "বিস্তারিত নির্দেশনা কমপক্ষে ২০ অক্ষরের লিখুন");
    if (!Number.isFinite(reward) || reward < 1) return markInvalid(rewardEl, "পুরস্কার কমপক্ষে ৳১");
    if (!Number.isInteger(slots) || slots < 1 || slots > 1000) return markInvalid(slotsEl, "স্লট ১-১০০০ এর মধ্যে দিন");
    if (imageUrl && !v.url(imageUrl)) return markInvalid($("#ct-image"), "ছবির URL সঠিক নয়");

    const total = reward * slots;
    const ok = await confirmDialog(`মোট বাজেট ${money(total)} প্রকাশের সাথে সাথে reserve হবে। নিশ্চিত?`, "প্রকাশ করুন");
    if (!ok) return;
    const restore = btnLoading($("#ct-submit"));
    try {
      // সম্পূর্ণ টাকার হিসাব server-side (admin SDK transaction)
      const res = await apiCall("task", {
        action: "create",
        title, description: desc, rules,
        reward, slots, deadlineHours, proofType, category, imageUrl,
      });
      toast("টাস্ক প্রকাশিত হয়েছে 🎉", "success");
      setTimeout(() => { location.hash = `#/task-details?id=${res.taskId}`; }, 700);
    } catch (err) {
      toast(friendlyError(err), "error", 4500);
      restore();
    }
  });

  const upBtn = $("#ct-image-upload");
  if (upBtn) upBtn.addEventListener("click", async () => {
    const f = $("#ct-image-file").files[0];
    if (!f) return toast("আগে ছবি নির্বাচন করুন", "warn");
    const restore = btnLoading(upBtn);
    try {
      const url = await uploadImage(f);
      $("#ct-image").value = url;
      toast("ছবি আপলোড হয়েছে ✓", "success");
    } catch (e2) { toast(friendlyError(e2), "error"); }
    finally { restore(); }
  });
}

/* ================= Buyer: আমার টাস্ক ================= */
export async function bindMyTasksPage() {
  const listEl = $("#mytask-list");
  if (!listEl) return;
  showLoading(listEl, "আপনার টাস্ক লোড হচ্ছে...");
  try {
    const snap = await get(query(ref(db(), "tasks"), orderByChild("buyerId"), equalTo(uid()), limitToLast(60)));
    const tasks = [];
    snap.forEach((c) => tasks.push({ id: c.key, ...c.val() }));
    tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    await Promise.all(tasks.map(async (tk) => {
      try {
        const aSnap = await get(ref(db(), `taskAssignments/${tk.id}`));
        tk.filled = aSnap.exists() ? aSnap.size : 0;
      } catch { tk.filled = 0; }
    }));
    if (!tasks.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="ico">📋</div><h4>এখনও কোনো টাস্ক নেই</h4><p>প্রথম টাস্ক তৈরি করে Worker নিয়োগ করুন</p>
        <a class="btn btn-primary mt-3" style="width:auto" href="#/create-task">➕ টাস্ক তৈরি করুন</a></div>`;
      return;
    }
    listEl.innerHTML = tasks.map((tk) => {
      const remaining = Math.max(0, (tk.slots || 0) - (tk.filled || 0));
      return `
      <div class="task-card">
        <div class="tc-top">
          <div class="tc-title">${esc(tk.title)}</div>
          <span class="status-pill ${esc(tk.status)}">${statusBn(tk.status)}</span>
        </div>
        <div class="tc-meta mt-1">
          <span>💰 ${money(tk.reward)}/কাজ</span>
          <span> SLOT: ${tk.filled || 0}/${tk.slots}</span>
          <span>✅ অনুমোদিত: ${tk.approvedCount || 0}</span>
          <span>🏦 Reserve: ${money(tk.reservedRemaining || 0)}</span>
        </div>
        <div class="tc-foot">
          <span class="small">${fmtTime(tk.createdAt)}</span>
          <a class="btn btn-primary btn-sm" href="#/submissions?task=${tk.id}">রিভিউ (${tk.pendingCount || "—"})</a>
        </div>
      </div>`;
    }).join("");
  } catch (e) {
    listEl.innerHTML = emptyBox(friendlyError(e));
  }
}

/* ---------- shared ---------- */
export function statusBn(s) {
  return { active: "চলমান", full: "পূর্ণ", completed: "সম্পন্ন", cancelled: "বাতিল", blocked: "বন্ধ",
    pending: "অপেক্ষমাণ", approved: "অনুমোদিত", rejected: "প্রত্যাখৃত", in_progress: "চলমান", submitted: "জমা দেওয়া হয়েছে" }[s] || s;
}
function emptyBox(msg) {
  return `<div class="empty-state"><div class="ico">⚠️</div><h4>${esc(msg)}</h4><a class="btn btn-primary mt-3" style="width:auto" href="#/tasks">টাস্ক তালিকায় ফিরুন</a></div>`;
}
