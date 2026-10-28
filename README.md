# WhatsApp Task Earning Website

সম্পূর্ণ, আধুনিক, মোবাইল-ফার্স্ট **WhatsApp Task Earning** মার্কেটপ্লেস —
**Buyer** টাস্ক দেয়, **Worker** কাজ করে আয় করে, **Admin** সবকিছু নিয়ন্ত্রণ করে।

- স্ট্যাক: **HTML5 + CSS3 + Vanilla JavaScript (ES Modules)** — কোনো React/Next.js/framework নেই
- ব্যাকএন্ড: **Firebase Authentication + Realtime Database** + **Vercel Serverless API** (Firebase Admin SDK)
- ছবি হোস্টিং: **ImgBB** (নিরাপদ server-side প্রক্সি দিয়ে)
- UI: **বাংলা প্রধান** + English টগল, রেফারেন্স সাইটের মতো hash routing (`/#/home` ইত্যাদি)

> ⚠️ **নিরাপত্তা ঘোষণা:** এই প্ল্যাটফর্ম কোনো WhatsApp OTP/পাসওয়ার্ড/ভেরিফিকেশন কোড সংগ্রহ করে না এবং কারও WhatsApp অ্যাকাউন্টে অননুমোদিত প্রবেশের কোনো ব্যবস্থা নেই। "WhatsApp লিংক" ফিচারটি শুধু ব্যবহারকারীর **সম্মতিতে নম্বর সংরক্ষণ** (বৈধ প্রচারমূলক টাস্কের জন্য)। বাস্তব পেমেন্ট গেটওয়ে API ছাড়া ডিপোজিট/উত্তোলন **ম্যানুয়াল যাচাই-ভিত্তিক** — এটিই নিরাপদ ও সৎ পদ্ধতি।

---

## ১. ZIP Extract

1. `WhatsApp-Task-Earning-Website.zip` ডাউনলোড করে extract করুন
2. ভেতরে একটাই মূল ফোল্ডার পাবেন: `WhatsApp-Task-Earning-Website/`
3. ওই ফোল্ডারটিই প্রজেক্ট রুট — এটিকেই GitHub repo-তে আপলোড করবেন

## ২. ফোল্ডার কাঠামো

```
WhatsApp-Task-Earning-Website/
├── index.html                 # ইউজার অ্যাপ (SPA, hash router)
├── package.json               # npm scripts + firebase-admin dependency
├── vercel.json                # Vercel config (headers, functions)
├── README.md                  # এই ফাইল
├── LICENSE, .gitignore, .env.example
├── public/                    # লোগো, ফেভিকন, ব্যানার, আইকন
├── src/
│   ├── css/                   # main, auth, dashboard, tasks, wallet, responsive
│   ├── js/                    # app, router, firebase-config, auth, user, tasks,
│   │                          # submissions, wallet, referrals, spin, notifications,
│   │                          # whatsapp, profile, home, utils, i18n
│   └── pages/                 # ২০টি পেজ fragment (login, home, tasks, wallet, spin...)
├── admin/                     # পৃথক Admin প্যানেল (আলাদা entry: /admin/)
│   ├── index.html, css/admin.css
│   └── js/                    # admin-app, admin-auth, dashboard, users, tasks,
│                              # submissions, deposits, withdrawals, reports, settings
├── api/                       # Vercel Serverless Functions (Node.js)
│   ├── _lib/                  # admin SDK init, http helpers, auth/audit helpers
│   ├── task.js                # টাস্ক তৈরি/বাতিল/রেফারেল ট্রান্সফার (atomic wallet)
│   ├── submission-review.js   # অনুমোদন/প্রত্যাখ্যান + পুরস্কার ক্রেডিট + রেফারেল বোনাস
│   ├── spin.js                # সার্ভার-অথরিটেটিভ স্পিন
│   ├── deposit.js, withdrawal.js, admin.js, upload-image.js
│   └── README.md
├── firebase/
│   ├── database.rules.json    # সম্পূর্ণ Realtime Database Security Rules
│   └── README.md              # rules প্রয়োগের নিয়ম
├── scripts/validate.js        # npm run build = সম্পূর্ণ ভ্যালিডেশন
└── tests/                     # run-tests.js + README
```

## ৩. Firebase প্রজেক্ট তৈরি

1. https://console.firebase.google.com → **Add project**
2. নাম দিন (যেমন `task-earning`) → Google Analytics ঐচ্ছিক → **Create**
3. **Build → Authentication → Get started** ক্লিক করে Authentication চালু করুন

## ৪–৫. Email/Password Sign-In সক্রিয় করা

- Authentication → **Sign-in method** ট্যাব → **Email/Password** → Enable → Save

## ৬. Google Sign-In সক্রিয় করা

- Sign-in method → **Google** → Enable → Support email নির্বাচন করুন → Save
- (Vercel ডোমেইন যোগ করার পরেই Google pop-up ডোমেইনে কাজ করবে — ধাপ ৭)

## ৭. Authorized Domain যোগ করা

- Authentication → Settings → **Authorized domains** → **Add domain**
- যোগ করুন: `your-app.vercel.app` (Vercel ডিপ্লয়ের পরে পাবেন) এবং নিজের কাস্টম ডোমেইন থাকলে সেটিও
- লোকাল টেস্টের জন্য `localhost` ডিফল্টেই থাকে

## ৮. Realtime Database তৈরি

- Build → **Realtime Database** → **Create Database**
- Location: `asia-southeast1` (সিঙ্গাপুর) সুপারিশকৃত
- Mode: **Locked mode** দিয়ে শুরু করুন (নিরাপদ)
- প্রথম ডাটা হিসেবে Console-এ `settings` নোডে একটি ছোট ডামি মান দিতে পারেন (যেমন `settings/init = true`) — না দিলেও চলবে, প্রথম Admin bootstrap-এর পরে Admin Settings থেকে সব সেট হবে

## ৯. Database URL বসানো — ✓ আগেই হয়ে গেছে

- ✅ **আপনার Firebase Web Config ইতিমধ্যে `src/js/firebase-config.js` ফাইলে বসানো আছে**
  (প্রজেক্ট: `whatsapp-tacks`) — এ ধাপে আর কিছু করতে হবে না
- ভবিষ্যতে পরিবর্তন লাগলে: `src/js/firebase-config.js` খুলুন → `firebaseConfig` অবজেক্ট
- মানগুলো পাবেন: Project settings → General → Your apps → **Web app (</>)**

## ১০. Database Security Rules প্রকাশ

> ⚠ **অত্যন্ত জরুরি:** যাচাই করে দেখা গেছে আপনার `whatsapp-tacks` ডাটাবেজ এখন
> **test mode / খোলা rules**-এ আছে (লগইন ছাড়াই সবাই পড়তে পারছে)। সাইট লঞ্চের
> **আগেই** এই ধাপটি করুন, নাহলে সবার ব্যালেন্স/ডাটা প্রকাশ্য হয়ে যাবে।

- Realtime Database → **Rules** ট্যাব
- `firebase/database.rules.json` এর পুরো কনটেন্ট পেস্ট করে **Publish**
- বিস্তারিত ব্যাখ্যা: `firebase/README.md`

## ১১. Vercel Environment Variables

Vercel Dashboard → আপনার Project → **Settings → Environment Variables** → নিচের ৫টি যোগ করুন (Production + Preview + Development সব কটিতে):

| Variable | মান কোথায় পাবেন |
|---|---|
| `FIREBASE_PROJECT_ID` | Project settings → General |
| `FIREBASE_CLIENT_EMAIL` | ধাপ ১২-এর service account JSON-এর `client_email` |
| `FIREBASE_PRIVATE_KEY` | JSON-এর `private_key` (পুরোটা, `"..."` সহ) |
| `IMGBB_API_KEY` | ✅ আপনার key প্রজেক্টের `.env` ফাইলে বসানো আছে — সেখান থেকে কপি করুন |
| `ADMIN_EMAILS` | `ashrafulhaqedulon@gmail.com` (কোমা দিয়ে একাধিক দেওয়া যায়) |

`.env.example` ফাইলে সব ভেরিয়েবলের ব্যাখ্যা আছে।

## ১২. Vercel-এ Deploy

**GitHub দিয়ে (সুপারিশকৃত):**
1. GitHub-এ নতুন repo তৈরি করুন → এই ফোল্ডারের সব ফাইল push করুন
2. https://vercel.com → **Add New → Project** → GitHub repo import করুন
3. Framework Preset: **Other** (auto) — Build Command খালি, Output খালি রাখুন
4. ধাপ ১১-এর Environment Variables যোগ করুন → **Deploy**
5. ডিপ্লয় হলে `https://<app>.vercel.app` লিংক পাবেন

**Firebase Admin SDK service account (serverless API-র জন্য):**
1. Firebase Console → Project settings → **Service accounts** → **Generate new private key**
2. JSON ফাইল খুলে `client_email` ও `private_key` মান দুটি ধাপ ১১ অনুযায়ী Vercel-এ বসান
3. ⚠️ এই JSON ফাইল **কখনো** git/ZIP-এ রাখবেন না — `.gitignore` এটিকে ব্লক করে

## ১৩. Admin role নিরাপদভাবে কনফিগার

**পদ্ধতি A — Bootstrap API (সুপারিশকৃত):**
1. Vercel-এ `ADMIN_EMAILS` সেট করে রিডিপ্লয় করুন
2. ওই ইমেইল দিয়ে সাইটে **রেজিস্ট্রেশন/লগইন** করুন (একবার)
3. ব্রাউজারে `https://<app>.vercel.app/admin/` খুলুন → একই ইমেইল দিয়ে লগইন করুন
4. "🛡️ আমাকে Admin করুন (Bootstrap)" বাটন চাপুন → server `ADMIN_EMAILS` যাচাই করে `role='admin'` দেবে
5. গার্ড: সিস্টেমে একজন Admin থাকার পরে bootstrap আর কাজ করবে না (নিরাপত্তা)
6. পরবর্তী Admin-রা: বর্তমান Admin **Admin Panel → Users → রোল পরিবর্তন** বা Firebase Console দিয়ে দেবে

**পদ্ধতি B — Firebase Console:**
1. ওই ইউজার একবার সাইটে লগইন করুন (প্রোফাইল তৈরি হবে)
2. Realtime Database → `users` → ওই UID-এর নোড → `role` = `"admin"` সেট করুন

> শুধু HTML/JS-এ ইমেইল লিখে Admin বানানো হয় না — প্রতিটি Admin অ্যাকশন server-side পুনরায় যাচাই হয় এবং `adminAuditLogs`-এ লগ হয়।

## ১৪. ImgBB server-side integration

- API key শুধু Vercel env-এ (`IMGBB_API_KEY`) — client কোডে **নেই**
- আপলোড ফ্লো: ব্রাউজার → `POST /api/upload-image` (ID token সহ) → server key দিয়ে ImgBB কল → URL ফেরত
- সীমা: JPG/PNG/WebP/GIF, ≤ ৮MB, প্রতি ইউজার ৫ মিনিটে ১০টি

## ১৫. লোকাল টেস্ট

```bash
npm install          # dependencies
npm run build        # সম্পূর্ণ ভ্যালিডেশন (ফাইল/পাথ/JSON/সিনট্যাক্স চেক)
npm start            # http://localhost:3000 এ সাইট চালু (serve)
```

> `firebase-config.js` বসানোর আগে সাইট খুললে বন্ধুত্বপূর্ণ সেটআপ গাইড দেখাবে — সাদা স্ক্রিন নয়।

## ১৬. Build error নির্ণয়

- `npm run build` কোন ফাইলে কী সমস্যা তা স্পষ্ট করে দেখায়
- ব্রাউজার: F12 → Console — লাল error-এর ফাইল/লাইন নম্বর দেখুন
- Vercel Deploy Log: Functions ট্যাবে runtime error দেখায় (প্রায়শই env var অনুপস্থিত থাকলে `ENV_MISSING` মেসেজ আসে)
- Firebase rules error: Console → Realtime Database → Rules → Publish করা আছে কি না দেখুন

---

## টেস্টিং রিপোর্ট (ডেলিভারির আগে চালানো হয়েছে)

`npm install` ✅ সফল · `npm run build` (validate) ✅ সফল · `npm test` ✅ সফল
বিস্তারিত ফলাফল: ডেলিভারি মেসেজ ও `tests/README.md` দেখুন। যেসব ফিচার **আপনার credentials** লাগবে:
Firebase Auth (Email/Password/Google), Realtime Database read/write, সব serverless API
(FIREBASE_* env), ImgBB আপলোড (IMGBB_API_KEY), Admin bootstrap (ADMIN_EMAILS)।
বাস্তব পেমেন্ট গেটওয়ে (bKash/Nagad/Rocket API) এই সংস্করণে **নেই** — ম্যানুয়াল যাচাই ব্যবস্থা আছে।

## নিরাপত্তা মডেল (সংক্ষেপ)

1. **Client কখনো টাকা লিখতে পারে না** — `wallets`, `transactions`, `tasks`, `spinState` সব RTDB rules-এ write=false; শুধু Admin SDK (serverless) লেখে
2. সব মানিক অপারেশন **RTDB transaction**-এ atomic — রেস কন্ডিশনে দ্বিগুণ ক্রেডিট/ডেবিট অসম্ভব
3. প্রতিটি API কলে **Firebase ID token verify** + blocked-user ব্লক
4. Admin অ্যাকশন server-এ `role === 'admin'` পুনরায় যাচাই + **অডিট লগ**
5. স্পিনের ফলাফল **১০০% server-side** — DevTools দিয়ে জেতা অসম্ভব
6. এক Worker-এক টাস্কে একবারই জমা (assignment-state লক), এক জমায় একবারই পুরস্কার (status-claim লক), এক ডিপোজিট TrxID একবারই অনুমোদন (duplicate scan)
7. ব্যবহারকারী নিজের `role`/`status`/`referredBy` বদলাতে পারে না (rules validate)

## সীমাবদ্ধতা ও সৎ ঘোষণা

- **পেমেন্ট:** bKash/Nagad/Rocket শুধু UI + ম্যানুয়াল যাচাই — অটোমেটিক পেমেন্ট গেটওয়ে API যুক্ত নয় (credentials লাগবে)
- **Phone/OTP লগইন:** Firebase Phone Auth-এর জন্য Blaze (পেইড) প্ল্যান লাগে — এই সংস্করণে Email+Google আছে
- **রেফারেল অ্যাবিউজ:** একই ব্যক্তির দুটি অ্যাকাউন্ট খুলে বোনাস নেওয়া rules-এ ১০০% আটকানো যায় না; কমাতে WhatsApp নম্বর যাচাই + Admin রিভিউ + ব্লক টুল দেওয়া আছে
- **টাস্ক স্লট:** স্লট সংখ্যা `taskAssignments` গণনা থেকে দেখানো হয়; খুব একসাথে অনেকে নিলে সামান্য overshoot হতে পারে — আর্থিক ক্ষতি হয় না (কারণ টাকা reserve-এ আটকে থাকে এবং অনুমোদন server-এ যাচাই হয়)

## License

MIT — বিস্তারিত `LICENSE` ফাইলে।
