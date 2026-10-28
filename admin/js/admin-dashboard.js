/* admin-dashboard.js — মোট পরিসংখ্যান ও সাম্প্রতিক কার্যক্রম */
import { ref, get, query, orderByChild, equalTo, limitToLast } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getDb } from "../../src/js/firebase-config.js";
import { esc, money, fmtTime } from "../../src/js/utils.js";

export async function render(main) {
  const db = getDb();
  const [usersSnap, tasksSnap, statSubs, statDeps, statWds, depsPending, wdsPending, statsSnap, auditSnap] = await Promise.all([
    get(ref(db, "users")),
    get(ref(db, "tasks")),
    countNested("submissions", "pending"),
    countNested("submissions", "approved"),
    countNested("submissions", "rejected"),
    countNested("depositRequests", "pending"),
    countNested("withdrawalRequests", "pending"),
    get(ref(db, "stats/global")),
    get(query(ref(db, "adminAuditLogs"), orderByChild("at"), limitToLast(8))),
  ]);

  let totalUsers = 0, buyers = 0, workers = 0, blocked = 0;
  usersSnap.forEach((c) => {
    totalUsers++;
    const r = c.child("role").val();
    if (r === "buyer") buyers++;
    else if (r === "worker") workers++;
    if (c.child("status").val() === "blocked") blocked++;
  });
  let activeTasks = 0, allTasks = 0, taskBudget = 0;
  tasksSnap.forEach((c) => {
    allTasks++;
    if (c.child("status").val() === "active") activeTasks++;
    taskBudget += Number(c.child("reward").val() || 0) * Number(c.child("slots").val() || 0);
  });
  const stats = statsSnap.exists() ? statsSnap.val() : { totalPayout: 0 };

  const logs = [];
  auditSnap.forEach((c) => logs.push(c.val()));
  logs.reverse();

  main.innerHTML = `
  <div class="a-stats">
    <div class="a-stat indigo"><div class="v">${totalUsers}</div><div class="l">মোট ব্যবহারকারী</div></div>
    <div class="a-stat"><div class="v">${buyers}</div><div class="l">Buyer</div></div>
    <div class="a-stat"><div class="v">${workers}</div><div class="l">Worker</div></div>
    <div class="a-stat red"><div class="v">${blocked}</div><div class="l">ব্লকড অ্যাকাউন্ট</div></div>
    <div class="a-stat green"><div class="v">${activeTasks}</div><div class="l">Active টাস্ক (মোট ${allTasks})</div></div>
    <div class="a-stat amber"><div class="v">${statSubs}</div><div class="l">পেন্ডিং সাবমিশন</div></div>
    <div class="a-stat"><div class="v">${statDeps}</div><div class="l">অনুমোদিত সাবমিশন</div></div>
    <div class="a-stat red"><div class="v">${statWds}</div><div class="l">প্রত্যাখৃত সাবমিশন</div></div>
    <div class="a-stat amber"><div class="v">${depsPending}</div><div class="l">পেন্ডিং ডিপোজিট</div></div>
    <div class="a-stat amber"><div class="v">${wdsPending}</div><div class="l">পেন্ডিং উত্তোলন</div></div>
    <div class="a-stat green"><div class="v">${money(stats.totalPayout || 0)}</div><div class="l">মোট অনুমোদিত পেআউট</div></div>
    <div class="a-stat indigo"><div class="v">${money(taskBudget)}</div><div class="l">টাস্ক বাজেট (reserve সহ)</div></div>
  </div>

  <div class="a-card">
    <h3>🧾 সাম্প্রতিক Admin কার্যক্রম <a class="a-btn ghost sm" href="#/audit">সব দেখুন</a></h3>
    ${logs.length ? `<div class="a-table-wrap"><table class="a-table">
      <thead><tr><th>সময়</th><th>Admin</th><th>অ্যাকশন</th><th>টার্গেট</th></tr></thead>
      <tbody>${logs.map((l) => `<tr><td>${fmtTime(l.at)}</td><td>${esc(l.adminEmail || "—")}</td><td>${esc(l.action || "")}</td><td class="mono">${esc(l.target || "")}</td></tr>`).join("")}</tbody>
    </table></div>` : '<div class="a-empty">এখনও কোনো অডিট লগ নেই</div>'}
  </div>`;
}

async function countNested(node, status) {
  const snap = await get(ref(db, node));
  let n = 0;
  snap.forEach((lvl) => lvl.forEach((c) => { if (c.child("status").val() === status) n++; }));
  return n;
}
