#!/usr/bin/env node
/* tests/run-tests.js — npm test
   বিল্ড ভ্যালিডেশন + স্ট্রাকচার অখণ্ডতা + নিরাপত্তা অভিমুখী স্ট্যাটিক চেক।
   Firebase/পেমেন্ট লাইভ টেস্টের জন্য credentials লাগে — tests/README.md দেখুন। */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try {
    const r = fn();
    if (r === false) throw new Error("ব্যর্থ");
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    fail++;
    failures.push(`${name} — ${e.message}`);
    console.log(`  ❌ ${name} — ${e.message}`);
  }
}
const mustExist = (p) => fs.existsSync(path.join(ROOT, p));

console.log("═".repeat(62));
console.log(" WhatsApp Task Earning Website — Test Suite");
console.log("═".repeat(62));

console.log("\n[১] গুরুত্বপূর্ণ ফাইলের অস্তিত্ব");
[
  "index.html", "package.json", "vercel.json", "README.md", "LICENSE",
  ".gitignore", ".env.example",
  "src/js/app.js", "src/js/router.js", "src/js/firebase-config.js",
  "src/js/auth.js", "src/js/tasks.js", "src/js/submissions.js", "src/js/wallet.js",
  "src/js/referrals.js", "src/js/spin.js", "src/js/notifications.js",
  "src/css/main.css", "src/css/responsive.css", "src/css/auth.css",
  "src/css/dashboard.css", "src/css/tasks.css", "src/css/wallet.css",
  "admin/index.html", "admin/css/admin.css", "admin/js/admin-app.js", "admin/js/admin-auth.js",
  "admin/js/admin-dashboard.js", "admin/js/admin-users.js", "admin/js/admin-tasks.js",
  "admin/js/admin-submissions.js", "admin/js/admin-deposits.js", "admin/js/admin-withdrawals.js",
  "admin/js/admin-reports.js", "admin/js/admin-settings.js",
  "api/task.js", "api/submission-review.js", "api/spin.js", "api/deposit.js",
  "api/withdrawal.js", "api/admin.js", "api/upload-image.js", "api/README.md",
  "api/_lib/admin.js", "api/_lib/auth.js", "api/_lib/http.js",
  "firebase/database.rules.json", "firebase/README.md",
  "scripts/validate.js", "tests/README.md",
  "public/favicon.svg", "public/favicon.ico", "public/assets/logo/logo.svg",
  "public/assets/images/banner-home.svg", "public/assets/icons/google.svg",
].forEach((p) => test(`ফাইল আছে: ${p}`, () => mustExist(p)));

console.log("\n[২] সব পেজ fragment");
[
  "login", "register", "reset", "home", "tasks", "task-details", "create-task",
  "my-tasks", "submissions", "wallet", "transaction-history", "referral", "spin",
  "whatsapp-link", "profile", "notifications", "about", "terms", "privacy",
  "task-rules", "faq", "contact",
].forEach((p) => test(`fragment: ${p}.html`, () => mustExist(`src/pages/${p}.html`)));

console.log("\n[৩] কনফিগারেশন অখণ্ডতা");
test("package.json বৈধ JSON + scripts", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return !!(pkg.scripts && pkg.scripts.build && pkg.scripts.test && pkg.dependencies["firebase-admin"]);
});
test("vercel.json বৈধ", () => {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  return Array.isArray(v.headers);
});
test("database.rules.json বৈধ + wallets write=false", () => {
  const r = JSON.parse(fs.readFileSync(path.join(ROOT, "firebase/database.rules.json"), "utf8"));
  const w = r.rules.wallets["$uid"][".write"];
  return w === false;
});
test(".gitignore-এ .env ব্লক করা", () => {
  const gi = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  return gi.includes(".env");
});
test(".env.example-এ শুধু placeholder", () => {
  const env = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const realKey = /MII[A-Za-z0-9+/]{80,}/.test(env);
  return !realKey && env.includes("FIREBASE_PRIVATE_KEY");
});

console.log("\n[৪] নিরাপত্তা অভিমুখী স্ট্যাটিক চেক");
test("client কোডে wallets write নেই", () => {
  const wallet = fs.readFileSync(path.join(ROOT, "src/js/wallet.js"), "utf8");
  const bad = [/update\(ref\(db\(\),\s*[`"']wallets/, /set\(ref\(db\(\),\s*[`"']wallets/, /push\(ref\(db\(\),\s*[`"']wallets/];
  return !bad.some((re) => re.test(wallet));
});
test("spin-এর ফলাফল server থেকে (client Math.random দিয়ে reward নেয় না)", () => {
  const spin = fs.readFileSync(path.join(ROOT, "src/js/spin.js"), "utf8");
  return spin.includes('apiCall("spin"');
});
test("review সবসময় API দিয়ে", () => {
  const subs = fs.readFileSync(path.join(ROOT, "src/js/submissions.js"), "utf8");
  return subs.includes('apiCall("submission-review"');
});
test("API-তে ID token verify আছে", () => {
  const authLib = fs.readFileSync(path.join(ROOT, "api/_lib/auth.js"), "utf8");
  return authLib.includes("verifyIdToken");
});
test("upload proxy-তে auth + rate limit", () => {
  const up = fs.readFileSync(path.join(ROOT, "api/upload-image.js"), "utf8");
  return up.includes("verifyUser") && up.includes("rateLimited");
});

console.log("\n[৫] রাউটিং অখণ্ডতা");
test("router-এ অন্তত ২০টি route", () => {
  const r = fs.readFileSync(path.join(ROOT, "src/js/router.js"), "utf8");
  const n = (r.match(/"\/[^"]*":/g) || []).length;
  return n >= 20 ? true : `মাত্র ${n}টি route`;
});
test("index.html-এ app.js entry", () => {
  const i = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  return i.includes('src="src/js/app.js"');
});

console.log("\n" + "═".repeat(62));
if (fail === 0) {
  console.log(` ✅ ${pass}টি টেস্ট সফল — কোনো ব্যর্থতা নেই।`);
  process.exit(0);
} else {
  console.log(` ❌ ${fail}টি টেস্ট ব্যর্থ (${pass} সফল):`);
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
}
