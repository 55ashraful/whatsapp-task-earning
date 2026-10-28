/* ============================================================
   i18n.js — বাংলা (প্রধান) + English ভাষা সহায়তা
   ============================================================ */

export const LANGS = { bn: "বাংলা", en: "English" };

const bn = {
  appName: "টাস্ক আর্নিং",
  // common
  home: "হোম", tasks: "টাস্ক", link: "লিংক", earnings: "আয়", account: "অ্যাকাউন্ট",
  wallet: "ওয়ালেট", referral: "রেফারেল", spin: "স্পিন", profile: "প্রোফাইল",
  notifications: "নোটিফিকেশন", about: "আমাদের সম্পর্কে", logout: "লগআউট",
  login: "লগইন", register: "রেজিস্ট্রেশন", submit: "জমা দিন", save: "সেভ করুন",
  cancel: "বাতিল", close: "বন্ধ করুন", confirm: "নিশ্চিত করুন", back: "পিছনে",
  loading: "লোড হচ্ছে...", retry: "আবার চেষ্টা করুন", refresh: "রিফ্রেশ",
  viewAll: "সব দেখুন", details: "বিস্তারিত", start: "শুরু করুন", share: "শেয়ার করুন",
  copy: "কপি", copied: "কপি হয়েছে!", language: "ভাষা", support: "সহায়তা",
  amount: "পরিমাণ", status: "অবস্থা", date: "তারিখ", time: "সময়", action: "অ্যাকশন",
  approve: "অনুমোদন", reject: "প্রত্যাখ্যান", reason: "কারণ", none: "কিছু নেই",
  total: "মোট", today: "আজ", yesterday: "গতকাল", all: "সব",
  success: "সফল হয়েছে", failed: "ব্যর্থ হয়েছে", required: "এই ঘরটি পূরণ করুন",
  // auth
  welcomeBack: "স্বাগতম", loginSub: "অ্যাকাউন্টে প্রবেশ করে আয় শুরু করুন",
  email: "ইমেইল", password: "পাসওয়ার্ড", confirmPassword: "পাসওয়ার্ড নিশ্চিত করুন",
  forgotPw: "পাসওয়ার্ড ভুলে গেছেন?", resetPw: "পাসওয়ার্ড রিসেট",
  loginBtn: "লগইন করুন", registerBtn: "রেজিস্ট্রেশন করুন", googleBtn: "Google দিয়ে চালিয়ে যান",
  noAccount: "অ্যাকাউন্ট নেই?", haveAccount: "অ্যাকাউন্ট আছে?",
  displayName: "আপনার নাম", chooseRole: "আপনার ভূমিকা নির্বাচন করুন",
  buyer: "Buyer (টাস্ক প্রদানকারী)", worker: "Worker (কাজ করার ইচ্ছুক)",
  buyerD: "টাস্ক তৈরি করবেন ও Worker-এর কাজ যাচাই করবেন",
  workerD: "উপলব্ধ টাস্ক সম্পন্ন করে আয় করবেন",
  referralCodeOptional: "রেফারেল কোড (ঐচ্ছিক)",
  resetSent: "রিসেট লিংক পাঠানো হয়েছে — ইমেইল দেখুন",
  // home
  todaysPayout: "আজকের মোট পেআউট", totalAdapters: "মোট ব্যবহারকারী",
  quickActions: "দ্রুত অ্যাকশন", availableTasks: "উপলব্ধ টাস্ক",
  myTasks: "আমার টাস্ক", recentActivity: "সাম্প্রতিক কার্যক্রম",
  guides: "ব্যবহারের নির্দেশাবলী", bindWhatsapp: "WhatsApp নম্বর যুক্ত করুন",
  boundWhatsapp: "যুক্ত WhatsApp নম্বর", welcomeTitle: "স্বাগতম জানাই 🎉",
  welcomeBody: "টাস্ক সম্পন্ন করে, রেফার করে ও স্পিন খেলে আয় করুন। শুরু করতে WhatsApp নম্বর যুক্ত করুন।",
  createTask: "টাস্ক তৈরি করুন", mySubmissions: "আমার জমা", deposit: "ডিপোজিট",
  withdraw: "উত্তোলন", transactions: "লেনদেন", inviteFriends: "বন্ধুদের আমন্ত্রণ",
  // tasks
  taskCategories: "টাস্ক ক্যাটাগরি", allTasks: "সব টাস্ক", taskDetails: "টাস্ক বিস্তারিত",
  reward: "পুরস্কার", slots: "স্লট", remaining: "অবশিষ্ট", deadline: "সময়সীমা",
  description: "বিবরণ", rules: "নিয়ম ও শর্ত", instructions: "করণীয় নির্দেশনা",
  proofRequired: "প্রমাণ জমার ধরন", startTask: "টাস্ক শুরু করুন",
  submitProof: "প্রমাণ জমা দিন", taskFull: "পূর্ণ", taskActive: "চলমান",
  taskCompleted: "সম্পন্ন", taskCancelled: "বাতিল", taskBlocked: "বন্ধ",
  screenshotUrl: "স্ক্রিনশট / ছবির URL", writtenProof: "লিখিত বিবরণ",
  reference: "রেফারেন্স (লিংক/আইডি)", uploadImage: "ছবি আপলোড",
  proofTypeText: "লিখিত বিবরণ", proofTypeImage: "স্ক্রিনশট", proofTypeBoth: "উভয়ই",
  // buyer create
  taskTitle: "টাস্কের শিরোনাম", rewardPerWorker: "প্রতি Worker পুরস্কার",
  totalSlots: "মোট Worker স্লট", budget: "মোট বাজেট", publish: "প্রকাশ করুন",
  insufficientBalance: "পর্যাপ্ত ব্যালেন্স নেই", reservedNote: "প্রকাশের সাথে সাথে বাজেট আপনার ওয়ালেট থেকে reserve হবে",
  // submissions
  pendingReview: "রিভিউ অপেক্ষমাণ", approved: "অনুমোদিত", rejected: "প্রত্যাখৃত",
  inProgress: "চলমান", rejectReasonPh: "প্রত্যাখ্যানের কারণ লিখুন...",
  // wallet
  availableBalance: "উত্তোলনযোগ্য ব্যালেন্স", pendingEarnings: "পেন্ডিং আয়",
  totalEarned: "মোট আয়", totalSpent: "মোট খরচ",
  depositHistory: "ডিপোজিট হিস্টোরি", withdrawHistory: "উত্তোলন হিস্টোরি",
  transactionHistory: "লেনদেন হিস্টোরি", paymentMethod: "পেমেন্ট মাধ্যম",
  senderNumber: "যে নম্বর থেকে পাঠিয়েছেন", trxId: "ট্রানজেকশন আইডি (TrxID)",
  accountNumber: "অ্যাকাউন্ট নম্বর", minDeposit: "সর্বনিম্ন ডিপোজিট",
  minWithdraw: "সর্বনিম্ন উত্তোলন", sendFirst: "প্রথমে নিচের নম্বরে Send Money করুন",
  depositPendingNote: "ডিপোজিট রিকোয়েস্ট Admin যাচাই করে অনুমোদন করলে ব্যালেন্স যোগ হবে",
  withdrawPendingNote: "উত্তোলন রিকোয়েস্ট Admin ২৪-৪৮ ঘণ্টার মধ্যে প্রসেস করবে",
  requestDeposit: "ডিপোজিট রিকোয়েস্ট", requestWithdraw: "উত্তোলন রিকোয়েস্ট",
  // referral
  referralProgram: "৫% ইনকাম বোনাস", yourCode: "আপনার রেফারেল কোড",
  yourLink: "আপনার রেফারেল লিংক", invitedFriends: "আমন্ত্রিত বন্ধু",
  referralEarn: "রেফারেল আয়", milestones: "মাইলস্টোন বোনাস",
  friends: "বন্ধু", rewardPerFriend: "প্রথম অনুমোদিত টাস্কে বোনাস",
  // spin
  luckyWheel: "ভাগ্যবান ক্যাশ চাকা", freeSpinsLeft: "ফ্রি স্পিন বাকি",
  myBalance: "আমার ব্যালেন্স", spinNow: "স্পিন করুন", paidSpin: "পেইড স্পিন",
  liveWinners: "লাইভ উইনার তালিকা", spinHistory: "স্পিন হিস্টোরি",
  youWon: "আপনি জিতেছেন", cooldown: "পরবর্তী ফ্রি স্পিন",
  spinRulesTitle: "ক্যাশফ্লো নির্দেশাবলী",
  // profile
  editProfile: "প্রোফাইল এডিট", userId: "ইউজার আইডি", role: "ভূমিকা",
  memberSince: "সদস্য হয়েছেন", accountStatus: "অ্যাকাউন্ট স্ট্যাটাস",
  blocked: "ব্লকড", active: "সক্রিয়", saveChanges: "পরিবর্তন সেভ করুন",
  photoUrl: "প্রোফাইল ছবির URL", changePhoto: "ছবি পরিবর্তন",
  // notifications
  markAllRead: "সব পড়া হয়েছে", systemNotices: "সিস্টেম ঘোষণা",
  personalNotifs: "ব্যক্তিগত নোটিফিকেশন", noNotifications: "কোনো নোটিফিকেশন নেই",
  // errors / states
  errNetwork: "নেটওয়ার্ক সমস্যা — সংযোগ পরীক্ষা করুন",
  errConfig: "Firebase কনফিগার করা হয়নি — README.md অনুসরণ করুন",
  errLogin: "ইমেইল বা পাসওয়ার্ড সঠিক নয়", errEmailInUse: "এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে",
  errWeakPw: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", errPwMatch: "দুটি পাসওয়ার্ড মিলছে না",
  errBlocked: "আপনার অ্যাকাউন্ট ব্লক করা হয়েছে — সাপোর্টে যোগাযোগ করুন",
  emptyTasks: "এখনও কোনো টাস্ক নেই", emptyTx: "কোনো লেনদেন নেই",
  emptySubs: "কোনো জমা নেই", emptyReferrals: "এখনও কোনো বন্ধু জয়েন করেননি",
  emptySpin: "এখনও কোনো স্পিন হয়নি", confirmLogout: "লগআউট করতে চান?",
};

const en = {
  appName: "Task Earning",
  home: "Home", tasks: "Tasks", link: "Link", earnings: "Earnings", account: "Account",
  wallet: "Wallet", referral: "Referral", spin: "Spin", profile: "Profile",
  notifications: "Notifications", about: "About", logout: "Logout",
  login: "Login", register: "Register", submit: "Submit", save: "Save",
  cancel: "Cancel", close: "Close", confirm: "Confirm", back: "Back",
  loading: "Loading...", retry: "Retry", refresh: "Refresh",
  viewAll: "View all", details: "Details", start: "Start", share: "Share",
  copy: "Copy", copied: "Copied!", language: "Language", support: "Support",
  amount: "Amount", status: "Status", date: "Date", time: "Time", action: "Action",
  approve: "Approve", reject: "Reject", reason: "Reason", none: "None",
  total: "Total", today: "Today", yesterday: "Yesterday", all: "All",
  success: "Success", failed: "Failed", required: "This field is required",
  welcomeBack: "Welcome back", loginSub: "Sign in to start earning",
  email: "Email", password: "Password", confirmPassword: "Confirm password",
  forgotPw: "Forgot password?", resetPw: "Reset password",
  loginBtn: "Login", registerBtn: "Register", googleBtn: "Continue with Google",
  noAccount: "No account?", haveAccount: "Already have an account?",
  displayName: "Your name", chooseRole: "Choose your role",
  buyer: "Buyer (posts tasks)", worker: "Worker (does tasks)",
  buyerD: "Create tasks and review worker submissions",
  workerD: "Complete available tasks and earn",
  referralCodeOptional: "Referral code (optional)",
  resetSent: "Reset link sent — check your email",
  todaysPayout: "Today's Payout", totalAdapters: "Total users",
  quickActions: "Quick actions", availableTasks: "Available tasks",
  myTasks: "My tasks", recentActivity: "Recent activity",
  guides: "Guides", bindWhatsapp: "Link WhatsApp number",
  boundWhatsapp: "Linked WhatsApp number",
  welcomeTitle: "Welcome 🎉",
  welcomeBody: "Earn by completing tasks, referring friends and spinning. Link your WhatsApp number to start.",
  createTask: "Create task", mySubmissions: "My submissions", deposit: "Deposit",
  withdraw: "Withdraw", transactions: "Transactions", inviteFriends: "Invite friends",
  taskCategories: "Categories", allTasks: "All tasks", taskDetails: "Task details",
  reward: "Reward", slots: "Slots", remaining: "Remaining", deadline: "Deadline",
  description: "Description", rules: "Rules & terms", instructions: "Instructions",
  proofRequired: "Proof type", startTask: "Start task",
  submitProof: "Submit proof", taskFull: "Full", taskActive: "Active",
  taskCompleted: "Completed", taskCancelled: "Cancelled", taskBlocked: "Blocked",
  screenshotUrl: "Screenshot / image URL", writtenProof: "Written description",
  reference: "Reference (link/ID)", uploadImage: "Upload image",
  proofTypeText: "Text", proofTypeImage: "Screenshot", proofTypeBoth: "Both",
  taskTitle: "Task title", rewardPerWorker: "Reward per worker",
  totalSlots: "Total worker slots", budget: "Total budget", publish: "Publish",
  insufficientBalance: "Insufficient balance", reservedNote: "The budget will be reserved from your wallet on publish",
  pendingReview: "Pending review", approved: "Approved", rejected: "Rejected",
  inProgress: "In progress", rejectReasonPh: "Write rejection reason...",
  availableBalance: "Available balance", pendingEarnings: "Pending earnings",
  totalEarned: "Total earned", totalSpent: "Total spent",
  depositHistory: "Deposit history", withdrawHistory: "Withdrawal history",
  transactionHistory: "Transaction history", paymentMethod: "Payment method",
  senderNumber: "Sender number", trxId: "Transaction ID (TrxID)",
  accountNumber: "Account number", minDeposit: "Min deposit",
  minWithdraw: "Min withdrawal", sendFirst: "First send money to the number below",
  depositPendingNote: "Balance is added after admin verifies your deposit request",
  withdrawPendingNote: "Admin processes withdrawal requests within 24-48 hours",
  requestDeposit: "Deposit request", requestWithdraw: "Withdrawal request",
  referralProgram: "5% income bonus", yourCode: "Your referral code",
  yourLink: "Your referral link", invitedFriends: "Invited friends",
  referralEarn: "Referral earnings", milestones: "Milestone bonus",
  friends: "friends", rewardPerFriend: "Bonus on first approved task",
  luckyWheel: "Lucky Cash Wheel", freeSpinsLeft: "Free spins left",
  myBalance: "My balance", spinNow: "SPIN", paidSpin: "Paid spin",
  liveWinners: "Live winners", spinHistory: "Spin history",
  youWon: "You won", cooldown: "Next free spin",
  spinRulesTitle: "Cashflow rules",
  editProfile: "Edit profile", userId: "User ID", role: "Role",
  memberSince: "Member since", accountStatus: "Account status",
  blocked: "Blocked", active: "Active", saveChanges: "Save changes",
  photoUrl: "Photo URL", changePhoto: "Change photo",
  markAllRead: "Mark all read", systemNotices: "System notices",
  personalNotifs: "Personal notifications", noNotifications: "No notifications",
  errNetwork: "Network problem — check your connection",
  errConfig: "Firebase not configured — follow README.md",
  errLogin: "Incorrect email or password", errEmailInUse: "An account with this email already exists",
  errWeakPw: "Password must be at least 6 characters", errPwMatch: "Passwords do not match",
  errBlocked: "Your account has been blocked — contact support",
  emptyTasks: "No tasks yet", emptyTx: "No transactions yet",
  emptySubs: "No submissions yet", emptyReferrals: "No friends joined yet",
  emptySpin: "No spins yet", confirmLogout: "Logout?",
};

const DICTS = { bn, en };
let current = localStorage.getItem("wte_lang") || "bn";
if (!DICTS[current]) current = "bn";

export function getLang() { return current; }

export function setLang(lang) {
  if (!DICTS[lang]) return;
  current = lang;
  localStorage.setItem("wte_lang", lang);
  document.documentElement.lang = lang;
  applyI18n(document);
}

/** কী দিয়ে অনুবাদ; না পেলে fallback (বা কী নিজেই) */
export function t(key, fallback) {
  const d = DICTS[current];
  if (d && Object.prototype.hasOwnProperty.call(d, key)) return d[key];
  if (current !== "bn" && bn[key]) return bn[key];
  return fallback !== undefined ? fallback : key;
}

/** data-i18n অ্যাট্রিবিউট সহ সব এলিমেন্টে অনুবাদ বসায় */
export function applyI18n(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = t(key, null);
    if (val !== null) el.textContent = val;
  });
  scope.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.getAttribute("data-i18n-ph");
    const val = t(key, null);
    if (val !== null) el.setAttribute("placeholder", val);
  });
}
