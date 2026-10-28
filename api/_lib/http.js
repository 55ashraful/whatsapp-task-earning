/* ============================================================
   api/_lib/http.js — JSON রেসপন্স, CORS, এরর হ্যান্ডলিং
   ============================================================ */

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function fail(res, status, message, code) {
  json(res, status, { ok: false, error: message, code: code || undefined });
}

function ok(res, data) {
  json(res, 200, { ok: true, ...data });
}

function methodGuard(req, res) {
  if (req.method !== "POST") {
    fail(res, 405, "শুধু POST অনুমোদিত", "method_not_allowed");
    return false;
  }
  return true;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) { // 2MB cap (image upload base64 এর জন্য)
        reject(Object.assign(new Error("Request body অতিরিক্ত বড় (max 2MB)"), { code: "body_too_large" }));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { reject(Object.assign(new Error("Invalid JSON body"), { code: "bad_json" })); }
    });
    req.on("error", reject);
  });
}

module.exports = { ok, fail, json, methodGuard, readBody };
