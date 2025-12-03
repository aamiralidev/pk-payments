// server/easypaisa.js
import crypto from "crypto";
import express from "express";

const router = express.Router();

/**
 * Easypaisa Hosted Checkout config
 * Use the values from your merchant portal / integration guide.
 *
 * NOTE:
 * - storeId and hashKey come from the Easypaisa merchant portal.
 * - returnUrl is typically your FINAL postBack URL
 *   (the one that receives status / desc / orderRefNum).
 */
const cfg = {
  env: process.env.EASYPAY_ENVIRONMENT || "sandbox", // "live" or "sandbox"
  storeId: process.env.EASYPAY_STORE_ID,
  hashKey: process.env.EASYPAY_HASH_KEY,
  returnUrl: process.env.EASYPAY_RETURN_URL, // final postBack URL (status/desc/orderRefNum)
  // You can override these via env if needed
  endpointIndexSandbox:
    process.env.EASYPAY_INDEX_SANDBOX ||
    "https://easypaystg.easypaisa.com.pk/easypay/Index.jsf",
  endpointIndexLive:
    process.env.EASYPAY_INDEX_LIVE ||
    "https://easypay.easypaisa.com.pk/easypay/Index.jsf",
};

/**
 * Easypaisa expects amount like "100.0" (last digit is decimal). :contentReference[oaicite:2]{index=2}
 * Your app uses PKR decimals (e.g. 100, 100.50), so we convert.
 */
function formatAmountForEasypay(amountPKR) {
  const n = Number(amountPKR);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Invalid amount");
  }
  // One decimal place, e.g. "100.0", "100.5"
  return n.toFixed(1);
}

/**
 * Build the string to encrypt for merchantHashedReq.
 * According to Easypaisa Merchant Guide, the concatenated string MUST
 * follow this order exactly: :contentReference[oaicite:3]{index=3}
 *
 * amount=&autoRedirect=&emailAddr=&mobileNum=&orderRefNum=&paymentMethod=&postBackURL=&storeId=
 *
 * Missing/optional fields should still appear as empty values.
 */
function buildHashString(fields) {
  const order = [
    "amount",
    "autoRedirect",
    "emailAddr",
    "mobileNum",
    "orderRefNum",
    "paymentMethod",
    "postBackURL",
    "storeId",
  ];

  const parts = order.map((key) => {
    const value =
      fields[key] === undefined || fields[key] === null ? "" : String(fields[key]);
    return `${key}=${value}`;
  });

  return parts.join("&");
}

/**
 * PKCS5 padding helper (block size = 16 bytes for AES).
 */
function pkcs5Pad(str, blockSize = 16) {
  const buf = Buffer.from(str, "utf8");
  const pad = blockSize - (buf.length % blockSize || blockSize);
  const padBuf = Buffer.alloc(pad, pad);
  return Buffer.concat([buf, padBuf]);
}

/**
 * Determine AES algorithm based on HASH key length (in bytes).
 * Official docs say AES/ECB/PKCS5Padding. :contentReference[oaicite:4]{index=4}
 */
function getAesAlgorithm(hashKey) {
  const len = Buffer.byteLength(hashKey, "utf8");
  if (len === 16) return "aes-128-ecb";
  if (len === 24) return "aes-192-ecb";
  if (len === 32) return "aes-256-ecb";
  throw new Error(
    `Invalid Easypaisa HASH_KEY length (${len} bytes). Expected 16, 24, or 32 bytes.`
  );
}

/**
 * Generate merchantHashedReq (or encryptedHashRequest in some docs)
 * using AES/ECB/PKCS5Padding + Base64, per Easypaisa guide
 * and community examples. :contentReference[oaicite:5]{index=5}
 */
function makeMerchantHashedReq(fields, hashKey) {
  if (!hashKey) throw new Error("Easypaisa HASH_KEY is missing");

  const algo = getAesAlgorithm(hashKey);
  const keyBuf = Buffer.from(hashKey, "utf8");

  const valueToEncrypt = buildHashString(fields);
  const padded = pkcs5Pad(valueToEncrypt, 16);

  const cipher = crypto.createCipheriv(algo, keyBuf, null);
  cipher.setAutoPadding(false); // we already padded

  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
  const base64 = encrypted.toString("base64");

  return base64;
}

/**
 * INIT endpoint for Easypaisa Hosted Checkout
 *
 * Frontend calls this, gets { endpoint, fields } and then
 * does a form POST (like JazzCash hosted).
 */
router.post("/api/payment/easypaisa/hosted/init", async (req, res) => {
  try {
    const { amountPKR, orderRefNum, emailAddr, mobileNum, autoRedirect } = req.body;

    if (!cfg.storeId || !cfg.hashKey || !cfg.returnUrl) {
      return res.status(500).json({
        ok: false,
        error:
          "Easypaisa config missing (storeId/hashKey/returnUrl). Check environment vars.",
      });
    }

    if (!orderRefNum) {
      return res.status(400).json({ ok: false, error: "orderRefNum is required" });
    }

    const amount = formatAmountForEasypay(amountPKR);

    // Fields as per Easypaisa POST method / hosted checkout docs. :contentReference[oaicite:6]{index=6}
    const coreFields = {
      amount, // e.g. "100.0"
      autoRedirect: autoRedirect === "0" || autoRedirect === 0 ? "0" : "1",
      emailAddr: emailAddr || "",
      mobileNum: mobileNum || "",
      orderRefNum, // max 20 alpha-numeric
      // For hosted credit card / MA checkout, docs reference CC_PAYMENT_METHOD for CC.
      // You can change this based on your enabled methods.
      paymentMethod: "CC_PAYMENT_METHOD",
      postBackURL: cfg.returnUrl,
      storeId: cfg.storeId,
    };

    const merchantHashedReq = makeMerchantHashedReq(coreFields, cfg.hashKey);

    const endpoint =
      cfg.env === "live" ? cfg.endpointIndexLive : cfg.endpointIndexSandbox;

    // These are the fields your frontend will POST to endpoint.
    // If your specific guide asks for a different hash param name
    // (e.g. encryptedHashRequest), just rename it here.
    const fields = {
      ...coreFields,
      merchantHashedReq,
    };

    return res.json({
      ok: true,
      endpoint,
      fields,
    });
  } catch (err) {
    console.error("Easypaisa hosted init error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to initialize Easypaisa hosted checkout",
    });
  }
});

/**
 * FINAL RETURN endpoint
 *
 * Easypaisa flow (simplified from official guide): :contentReference[oaicite:7]{index=7}
 * 1. Customer posts to Index.jsf with your fields + merchantHashedReq.
 * 2. Easypaisa redirects user to your *first* postBackURL with ?auth_token=...
 * 3. Your backend calls Confirm.jsf with auth_token + postBackURL.
 * 4. Easypaisa redirects user to your *second* postBackURL with:
 *    - status
 *    - desc
 *    - orderRefNum
 *
 * This route is intended for that final “status/desc/orderRefNum” page.
 * You’ll likely configure cfg.returnUrl to point here.
 */
router.get("/api/payment/easypaisa/hosted/return", async (req, res) => {
  const { status, desc, orderRefNum } = req.query;

  // You should ALSO call Easypaisa "inquire-transaction" API server-to-server
  // to double-check the transactionStatus and responseCode before marking
  // an order as PAID. :contentReference[oaicite:8]{index=8}

  const success = typeof status === "string" && status.toLowerCase() === "success";

  let message;

  if (success) {
    message = `
      ✅ Payment Successful<br/>
      Order Reference: <strong>${orderRefNum || "N/A"}</strong><br/>
      Status: <strong>${status}</strong><br/>
      ${desc ? `Description: <strong>${desc}</strong><br/>` : ""}
      Thank you! You can safely close this tab.
    `;
    // TODO: update order in DB as PAID (after verifying via inquire-transaction API)
  } else {
    message = `
      ❌ Payment Failed or Pending<br/>
      Order Reference: <strong>${orderRefNum || "N/A"}</strong><br/>
      Status: <strong>${status || "Unknown"}</strong><br/>
      Description: <strong>${desc || "No description provided"}</strong><br/>
      Please try again or contact support.
    `;
    // TODO: mark order as FAILED/PENDING accordingly in your DB.
  }

  return res
    .status(200)
    .send(`<html><body style="font-family:sans-serif;padding:20px;">${message}</body></html>`);
});

export default router;
