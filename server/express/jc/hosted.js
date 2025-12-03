// server/jazzcash.js
import crypto from "crypto";
import express from "express";


const router = express.Router();

const cfg = {
  env: process.env.JAZZCASH_ENVIRONMENT || "sandbox", // "live" for prod
  merchantId: process.env.JAZZCASH_MERCHANT_ID,
  password: process.env.JAZZCASH_PASSWORD,
  integritySalt: process.env.JAZZCASH_INTEGRITY_SALT,
  returnUrl: process.env.JAZZCASH_RETURN_URL,
  endpointSandbox: "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform",
  endpointLive: "https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform",
};

function makeSecureHash(params, integritySalt) {

  if (!integritySalt) throw new Error("Integrity salt missing");

  // include only pp_* fields EXCLUDING pp_SecureHash and empty values
  const entries = Object.entries(params)
    .filter(([k, v]) => k.startsWith("pp_") && k !== "pp_SecureHash" && v !== undefined && v !== null && String(v).trim() !== "");

  // sort by key (ASCII)
  const sorted = entries.sort(([a], [b]) => a.localeCompare(b));

  // take VALUES only, joined by '&'
  const values = sorted.map(([, v]) => String(v));
  const toSign = [integritySalt, ...values].join("&");
  console.log("To sign is: ", toSign)
  return crypto.createHmac("sha256", integritySalt).update(toSign, "utf8").digest("hex");
}


// Format YYYYMMDDHHMMSS in PKT (server time is fine as long as consistent)
function formatDateTime(d) {
  const pad = n => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

const pkrToPaisa = (amountDecimal) => {
  const val = Math.round(Number(amountDecimal) * 100);
  if (Number.isNaN(val) || val <= 0) throw new Error('Invalid amount');
  return String(val);
};

export function generateTxnRefNo() {
  const base = Date.now().toString().slice(-13); // last 13 digits of epoch ms
  const random3 = Math.floor(100 + Math.random() * 900); // 3 random digits
  return `T${base.slice(0, 13 - 3)}${random3}`.slice(0, 17); // ensure 17 chars
}


// INIT endpoint: returns fields + endpoint URL to the client
router.post("/api/payment/jazzcash/hosted/init", async (req, res) => {
  const { amountPKR, orderId, description } = req.body;
  const now = formatDateTime(new Date())
  // JazzCash expects amount in paisa
  const fields = {
    pp_Version: "1.1",
    pp_TxnType: "MWALLET",
    pp_Language: "EN",
    pp_MerchantID: cfg.merchantId,
    pp_Password: cfg.password,
    pp_TxnRefNo: generateTxnRefNo(),
    pp_Amount: pkrToPaisa(amountPKR),
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: now,
    pp_BillReference: 'billRef',
    pp_Description: "Description of transaction",
    pp_ReturnURL: cfg.returnUrl,
    pp_SecureHashType: "SHA256",
  };

  const pp_SecureHash = makeSecureHash(fields, cfg.integritySalt);
  const endpoint =
    cfg.env === "live" ? cfg.endpointLive : cfg.endpointSandbox;

  res.json({ endpoint, fields: { ...fields, pp_SecureHash } });
});

// RETURN endpoint: JazzCash posts the result here
router.post("/api/payment/jazzcash/hosted/return", express.urlencoded({ extended: true }), async (req, res) => {
  const resp = req.body; // contains many pp_* fields + pp_SecureHash
  const { pp_SecureHash: receivedHash, ...rest } = resp;

  const computedHash = makeSecureHash(rest, cfg.integritySalt);
  const hashOk = receivedHash?.toLowerCase() === computedHash.toLowerCase();

  // Example decision (see response codes in the PDF)
  const approved = hashOk && (resp.pp_ResponseCode === "000" || resp.pp_TxnStatus === "1");

   let message;
    if (!hashOk) {
      // 1️⃣ hash verification failed — data might have been tampered with
      message = `
        ⚠️ Verification Failed<br/>
        We could not verify the authenticity of this payment.<br/>
        Please do not refresh or retry immediately; contact support with your Transaction Reference:
        <strong>${resp.pp_TxnRefNo || "N/A"}</strong>.
      `;
    } else if (approved) {
      // 2️⃣ payment succeeded
      message = `
        ✅ Payment Successful<br/>
        Transaction Reference: <strong>${resp.pp_TxnRefNo}</strong><br/>
        Amount: <strong>${Number(resp.pp_Amount) / 100} PKR</strong><br/>
        Thank you! You can safely close this tab.
      `;
    } else {
      // 3️⃣ hash verified but gateway returned failure
      message = `
        ❌ Payment Failed<br/>
        Transaction Reference: <strong>${resp.pp_TxnRefNo || "N/A"}</strong><br/>
        Response Code: <strong>${resp.pp_ResponseCode || "N/A"}</strong><br/>
        Description: <strong>${resp.pp_ResponseMessage || "Unknown error"}</strong><br/>
        Please try again or contact support.
        <details style="margin-top:10px;">
            <summary><strong>Debug: Full Response Body</strong></summary>
            <pre style="background:#f4f4f4;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:13px;">
        ${JSON.stringify(resp, null, 2)}
            </pre>
          </details>
      `;
    }

    // TODO: update order status in your DB based on 'approved' boolean

    return res
      .status(200)
      .send(`<html><body style="font-family:sans-serif;padding:20px;">${message}</body></html>`);
  }
);

export default router;
