# Tests

## চালানোর নিয়ম

```bash
npm install
npm test          # এই টেস্ট স্যুট (structure + security + config)
npm run build     # পূর্ণ ভ্যালিডেশন (syntax/refs/duplicates/rules)
npm start         # লোকাল সার্ভার → http://localhost:3000
```

## এই টেস্টগুলো কী কী চেক করে

1. **ফাইল অস্তিত্ব** — প্রতিটি গুরুত্বপূর্ণ ফাইল/fragment আছে কি না
2. **কনফিগারেশন** — package.json, vercel.json, rules JSON বৈধ কি না;
   `.gitignore` এ `.env` ব্লক করা কি না; `.env.example`-এ secret নেই কি না
3. **নিরাপত্তা অভিমুখী স্ট্যাটিক চেক** — client ওয়ালেট লিখছে না, স্পিন/রিভিউ
   server API দিয়ে হচ্ছে, API-তে token verify ও rate-limit আছে
4. **রাউটিং** — সব route-এর fragment আছে, entry point ঠিক আছে

## Integration টেস্ট (credentials লাগবে)

নিচের ফিচারগুলোর বাস্তব (live) টেস্টে যা যা লাগবে:

| ফিচার | প্রয়োজনীয় credentials |
|---|---|
| Email/Password লগইন-রেজিস্ট্রেশন | Firebase project + Email provider চালু |
| Google Sign-In | Google provider + authorized domain |
| সব ডাটাবেস অপারেশন | Realtime Database + rules publish |
| টাস্ক তৈরি/রিভিউ/স্পিন/ডিপোজিট | Vercel env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY |
| ছবি আপলোড | IMGBB_API_KEY |
| Admin bootstrap | ADMIN_EMAILS |
| অটো-পেমেন্ট (এই সংস্করণে নেই) | bKash/Nagad/Rocket merchant API (ভবিষ্যৎ কাজ) |

## ম্যানুয়াল QA চেকলিস্ট (ডিপ্লয়ের পরে)

- [ ] `/#/login`, `/#/register`, সরাসরি URL refresh — সাদা পেজ নয়
- [ ] Worker: টাস্ক শুরু → প্রমাণ জমা → Buyer অনুমোদন → ব্যালেন্স বাড়ল
- [ ] একই টাস্কে দ্বিতীয়বার জমা দিলে ব্লক হয়
- [ ] Buyer বাজেট অপর্যাপ্ত থাকলে টাস্ক প্রকাশ ব্লক হয়
- [ ] ডিপোজিট → Admin approve → ব্যালেন্স + নোটিফিকেশন
- [ ] একই TrxID দ্বিতীয়বার approve করলে ডুপ্লিকেট এরর
- [ ] স্পিন কুলডাউন/দৈনিক সীমা কাজ করে
- [ ] Admin প্যানেলে non-admin ঢুকলে "অ্যাক্সেস অনুমোদিত নয়"
- [ ] মোবাইল (375px) ও ডেস্কটপ (1280px) লেআউট
