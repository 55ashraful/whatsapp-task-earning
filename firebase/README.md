# Firebase — Realtime Database Security Rules

## Rules প্রয়োগ করার নিয়ম

### পদ্ধতি ১: Firebase Console (সবচেয়ে সহজ)
1. https://console.firebase.google.com → আপনার প্রজেক্ট খুলুন
2. বাম মেনু: **Realtime Database** → উপরের ট্যাব: **Rules**
3. `database.rules.json` ফাইলের পুরো কনটেন্ট কপি করে এডিটরে পেস্ট করুন
4. **Publish** চাপুন

### পদ্ধতি ২: Firebase CLI
```bash
npm install -g firebase-tools
firebase login
firebase init database   # প্রজেক্ট সিলেক্ট করুন, rules ফাইল হিসেবে firebase/database.rules.json দিন
firebase deploy --only database
```

## এই Rules কী নিশ্চিত করে

| নোড | নিয়ম |
|---|---|
| `users/{uid}` | শুধু মালিক পড়/লিখতে পারে; `role` ও `status` একবার সেট হলে বদলানো যায় না (admin বানানো অসম্ভব) |
| `wallets/{uid}` | **কেউই লিখতে পারবে না** — শুধু serverless API (Admin SDK) |
| `transactions/{uid}` | **কেউই লিখতে পারবে না** — শুধু serverless API |
| `tasks` | সব authenticated পড়তে পারে, লেখা শুধু server |
| `taskAssignments/{taskId}/{uid}` | worker নিজের স্লট একবারই নিতে পারে (active worker, active task) |
| `submissions/{taskId}/{subId}` | জমা শুধু একবার; assignment 'in_progress' থাকতে হয় (ডুপ্লিকেট ব্লক); buyer পড়তে পারে |
| `userSubmissions/{uid}` | worker-এর নিজের হিস্টোরি (mirror), শুধু তৈরি করা যায়, এডিট নয় |
| `depositRequests/{uid}` / `withdrawalRequests/{uid}` | ইউজার শুধু নতুন pending রিকোয়েস্ট তৈরি করতে পারে — status বদলানো যায় না |
| `notifications/{uid}` | ইউজার পড়তে পারে + শুধু `read: true` সেট করতে পারে; বাকি সব server |
| `settings`, `stats` | সব authenticated পড়বে, লিখবে শুধু server |
| `adminAuditLogs` | শুধু Admin পড়বে, লিখবে শুধু server |
| `spinState`, `spinHistory`, `referralRewards`, `referralRewardBalance` | শুধু মালিক পড়বে, লিখবে শুধু server |

## গুরুত্বপূর্ণ নোট

- **Admin role কখনো client থেকে সেট হয় না** — শুধু `/api/admin` (bootstrap, ADMIN_EMAILS যাচাই করে) বা Firebase Console-এ ম্যানুয়ালি।
- RTDB-র rules-এ query filter হয় না — তাই ইউজার-ভিত্তিক তথ্য (submissions, deposits) ইউজার/টাস্ক-নেস্টেড কাঠামোতে রাখা হয়েছে।
- Rules সংশোধনের পরে অবশ্যই **Simulator/Publish** টেস্ট করুন।
- প্রথম Admin নিয়োগ: README.md-এর "Admin role কনফিগার" সেকশন দেখুন।
