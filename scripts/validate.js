#!/usr/bin/env node
/* ============================================================
   scripts/validate.js — "npm run build"
   এটি একটি প্রকৃত ভ্যালিডেশন হার্নেস (এই প্রজেক্ট static site,
   কোনো কম্পাইল ধাপ নেই)। চেক করে:
   ১. সব JSON ফাইল বৈধ কি না (parse)
   ২. সব JS ফাইলের syntax (node --check)
   ৩. HTML-এর সব লোকাল src/href রেফারেন্স আছে কি না
   ৪. প্রতিটি HTML-এ duplicate id আছে কি না
   ৫. router-এর প্রতিটি route-এর page fragment আছে কি না
   ৬. JS-এ ব্যবহৃত /api/ endpoint ফাইল আছে কি না
   ৭. সম্ভাব্য secret leak স্ক্যান
   কোনো সমস্যা থাকলে non-zero exit — Vercel build ব্যর্থ হবে।
   ============================================================ */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const errors = [];
let checks = 0;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", ".vercel"].includes(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function rel(p) { return path.relative(ROOT, p).split(path.sep).join("/"); }
function err(msg) { errors.push(msg); }

const files = walk(ROOT);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const jsFiles = files.filter((f) => f.endsWith(".js"));
const jsonFiles = files.filter((f) => f.endsWith(".json"));

/* ১. JSON validity */
for (const f of jsonFiles) {
  checks++;
  try { JSON.parse(fs.readFileSync(f, "utf8")); }
  catch (e) { err(`JSON parse ব্যর্থ: ${rel(f)} — ${e.message}`); }
}

/* ২. JS syntax via node --check (ESM হলে .mjs হিসেবে) */
for (const f of jsFiles) {
  checks++;
  const src = fs.readFileSync(f, "utf8");
  const isModule = /^\s*(import|export)\s/m.test(src);
  const tmp = path.join(os.tmpdir(), `vchk-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    if (isModule) {
      fs.writeFileSync(tmp + ".mjs", src);
      execFileSync(process.execPath, ["--check", tmp + ".mjs"], { stdio: "pipe" });
    } else {
      fs.writeFileSync(tmp + ".js", src);
      execFileSync(process.execPath, ["--check", tmp + ".js"], { stdio: "pipe" });
    }
  } catch (e) {
    err(`JS syntax ত্রুটি: ${rel(f)} — ${String(e.stderr || e.message).slice(0, 400)}`);
  } finally {
    try { fs.rmSync(tmp + ".mjs", { force: true }); } catch {}
    try { fs.rmSync(tmp + ".js", { force: true }); } catch {}
  }
}

/* HTML helpers */
function extractRefs(html) {
  const refs = [];
  const re = /(?:src|href)\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) refs.push(m[1]);
  return refs;
}
function extractIds(html) {
  const ids = [];
  const re = /\sid\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) ids.push(m[1]);
  return ids;
}
function isExternal(ref) {
  return /^(https?:)?\/\//i.test(ref) || ref.startsWith("data:") || ref.startsWith("#") || ref.startsWith("mailto:") || ref.startsWith("tel:");
}
function localFileExists(ref, fromFile) {
  if (isExternal(ref)) return true;
  const clean = ref.split("#")[0].split("?")[0];
  if (!clean) return true;
  const target = path.resolve(path.dirname(fromFile), clean);
  return fs.existsSync(target);
}

/* ৩+৪. HTML refs + duplicate ids (fragment ফাইলগুলো নিচে আলাদা রুট-ভিত্তিক চেক হয়) */
const isFragment = (f) => f.includes(`${path.sep}src${path.sep}pages${path.sep}`);
for (const f of htmlFiles.filter((f) => !isFragment(f))) {
  checks++;
  const html = fs.readFileSync(f, "utf8");
  for (const r of extractRefs(html)) {
    if (!localFileExists(r, f)) err(`Broken reference: ${rel(f)} → "${r}"`);
  }
  const seen = new Set();
  for (const id of extractIds(html)) {
    if (seen.has(id)) err(`Duplicate id "${id}" in ${rel(f)}`);
    seen.add(id);
  }
}

/* ৫. Router pages vs fragments */
checks++;
const routerSrc = fs.readFileSync(path.join(ROOT, "src", "js", "router.js"), "utf8");
const routeMatches = [...routerSrc.matchAll(/"\/[^"]*":\s*\{\s*page:\s*"([^"]+)"/g)];
for (const m of routeMatches) {
  const frag = path.join(ROOT, "src", "pages", `${m[1]}.html`);
  if (!fs.existsSync(frag)) err(`Router route এর fragment নেই: src/pages/${m[1]}.html`);
}
if (routeMatches.length < 15) err(`Router-এ প্রত্যাশার চেয়ে কম route (${routeMatches.length})`);

/* fragment-গুলোর ভেতরের refs — fragment গুলো index.html (রুট) এ inject হয়,
   তাই রুট-রিলেটিভ পাথই সঠিক; রুট থেকে resolve করা হয় */
for (const frag of files.filter((f) => f.includes(`${path.sep}src${path.sep}pages${path.sep}`) && f.endsWith(".html"))) {
  checks++;
  const html = fs.readFileSync(frag, "utf8");
  for (const r of extractRefs(html)) {
    if (isExternal(r)) continue;
    const target = path.join(ROOT, r.split("#")[0].split("?")[0]);
    if (!fs.existsSync(target)) err(`Broken reference (fragment): ${rel(frag)} → "${r}"`);
  }
}

/* ৬. API endpoints used in JS vs files */
checks++;
const apiNames = new Set(files.filter((f) => f.startsWith(path.join(ROOT, "api")) && f.endsWith(".js")).map((f) => path.basename(f, ".js")));
for (const f of jsFiles) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/apiCall\(\s*["']([a-z0-9-]+)["']/gi)) {
    if (!apiNames.has(m[1])) err(`API endpoint ফাইল নেই: api/${m[1]}.js (ব্যবহৃত ${rel(f)})`);
  }
}

/* index.html ও admin shell */
checks++;
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
["src/js/app.js", "src/css/main.css"].forEach((must) => {
  if (!indexHtml.includes(must)) err(`index.html-এ ${must} রেফারেন্স নেই`);
});
const adminHtml = fs.readFileSync(path.join(ROOT, "admin", "index.html"), "utf8");
if (!adminHtml.includes("js/admin-app.js")) err("admin/index.html-এ admin-app.js রেফারেন্স নেই");

/* secret leak scan — বাস্তব key body (MII...) ধরা হয়; নিজের স্ক্যানার ফাইল বাদ */
checks++;
const SELF = /scripts[/\\]validate\.js|tests[/\\]run-tests\.js/;
const PEM_HEADER = "-----BEGIN " + "PRIVATE" + " KEY" + "-----";
const secretPatterns = [
  { re: new RegExp(PEM_HEADER.split("-").join("\\-") + "[^\"]*MII[A-Za-z0-9+/]{80,}"), msg: "Service account private key public code-e ache" },
  { re: /IMGBB_API_KEY\s*[=:]\s*["'][A-Za-z0-9]{15,}["']/, msg: "ImgBB key hard-coded" },
]

for (const f of jsFiles.concat(htmlFiles)) {
  if (SELF.test(f)) continue;
  const src = fs.readFileSync(f, "utf8");
  for (const { re, msg } of secretPatterns) {
    if (re.test(src) && !f.includes(".env")) err(`${msg}: ${rel(f)}`);
  }
}

/* ফলাফল */
console.log("═".repeat(62));
console.log(" WhatsApp Task Earning Website — Build Validation");
console.log("═".repeat(62));
console.log(` ফাইল স্ক্যান: ${files.length} | HTML: ${htmlFiles.length} | JS: ${jsFiles.length} | JSON: ${jsonFiles.length}`);
console.log(` চেক গ্রুপ: ${checks}`);
if (errors.length) {
  console.log(`\n ❌ ${errors.length}টি সমস্যা:\n`);
  errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  process.exit(1);
} else {
  console.log("\n ✅ সব ভ্যালিডেশন পাস — বিল্ড ঠিক আছে।");
  process.exit(0);
}
