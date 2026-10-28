# API — Vercel Serverless Functions (নিরাপদ ব্যাকএন্ড)

এই ফোল্ডারের সব function **server-side** চলে (Node.js) — ব্রাউজার কোড থেকে
কোনো secret দেখা যায় না। সব টাকা-সংক্রান্ত অপারেশন এখান দিয়ে যায়।

## এন্ডপয়েন্ট তালিকা

| এন্ডপয়েন্ট | কে কল করতে পারে | কাজ |
|---|---|---|
| `POST /api/task` (action: create) | Buyer | টাস্ক তৈরি — বাজেট atomic reserve |
| `POST /api/task` (action: cancel) | Buyer | নিজের টাস্ক বাতিল + রিফান্ড |
| `POST /api/task` (action: transferReferral) | ইউজার | রেফারেল ব্যালেন্স → মূল ব্যালেন্স |
| `POST /api/submission-review` | Buyer / Admin | জমা অনুমোদন/প্রত্যাখ্যান — পুরস্কার ক্রেডিট, রিফান্ড, রেফারেল বোনাস |
| `POST /api/spin` | ইউজার | ফ্রি/পেইড স্পিন — ফলাফল ১০০% server-সিদ্ধান্ত |
| `POST /api/deposit` (action: review) | Admin | ডিপোজিট অনুমোদন/বাতিল (ডুপ্লিকেট TrxID চেক সহ) |
| `POST /api/withdrawal` (action: request) | ইউজার | উত্তোলন রিকোয়েস্ট (সীমা যাচাই সহ) |
| `POST /api/withdrawal` (action: review) | Admin | উত্তোলন অনুমোদন/বাতিল (ব্যালেন্স কাটা atomic) |
| `POST /api/admin` | Admin | block/unblock, রোল, টাস্ক বন্ধ, সেটিংস, ব্রডকাস্ট, bootstrap |
| `POST /api/upload-image` | ইউজার | ImgBB আপলোড প্রক্সি (key server-এ) |

## নিরাপত্তা মডেল

1. প্রতিটি রিকোয়েস্টে `Authorization: Bearer <Firebase ID token>` থাকতে হয় —
   server `admin.auth().verifyIdToken()` দিয়ে যাচাই করে।
2. ব্যবহারকারীর `status === 'blocked'` হলে সব রিকোয়েস্ট 403।
3. Admin-নির্ভর অ্যাকশনগুলো RTDB-র `users/{uid}/role === 'admin'` পুনরায় যাচাই করে —
   শুধু ক্লায়েন্টের দাবি বিশ্বাস করে না।
4. সব ওয়ালেট পরিবর্তন RTDB **transaction** (atomic) — রেস কন্ডিশনে দ্বিগুণ
   ক্রেডিট/ডেবিট অসম্ভব। প্রতিটি টাকার আসা-যাওয়া `transactions/{uid}`-এ রেকর্ড হয়।
5. Admin-দের প্রতিটি অ্যাকশন `adminAuditLogs`-এ লগ হয়।
6. Env vars (Vercel → Settings → Environment Variables):
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
   - `IMGBB_API_KEY`
   - `ADMIN_EMAILS` (bootstrap-এর জন্য; ঐচ্ছিক `FIREBASE_DATABASE_URL`)

বিস্তারিত সেটআপ: মূল `README.md` দেখুন।
