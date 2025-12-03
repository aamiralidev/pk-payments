import express from "express";
import axios from 'axios';
import crypto from "crypto";
import qs from 'qs';
import z from 'zod';
import Jazzcash from './jzh.js'

const router = express.Router();

/** ---- JazzCash config ---- */
const JC_BASE_URL =
  process.env.JAZZCASH_ENVIRONMENT === 'production'
    ? 'https://www.jazzcash.com.pk' // live base (actual live Purchase URL is shared post-approval)
    : 'https://sandbox.jazzcash.com.pk';

const JC_MWALLET_URL = `${JC_BASE_URL}/ApplicationAPI/API/2.0/Purchase/DoMWalletTransaction`; // sandbox known endpoint. :contentReference[oaicite:3]{index=3}

const cfg = {
  merchantId: process.env.JAZZCASH_MERCHANT_ID,
  password: process.env.JAZZCASH_PASSWORD,
  integritySalt: process.env.JAZZCASH_INTEGRITY_SALT,
  returnUrl: process.env.JAZZCASH_RETURN_URL || 'https://example.com/jazzcash/return'
};

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

// Amount must be in "minor units" (PKR paisa): 10.00 PKR => "1000"
const pkrToPaisa = (amountDecimal) => {
  const val = Math.round(Number(amountDecimal) * 100);
  if (Number.isNaN(val) || val <= 0) throw new Error('Invalid amount');
  return String(val);
};

function makeSecureHash(params, integritySalt) {

  if (!integritySalt) throw new Error("Integrity salt missing");

  // include only pp_* fields EXCLUDING pp_SecureHash and empty values
  const entries = Object.entries(params)
    .filter(([k, v]) => k.startsWith("pp") && k !== "pp_SecureHash" && v !== undefined && v !== null && String(v).trim() !== "");

  // sort by key (ASCII)
  // const sorted = entries.sort(([a], [b]) => a.localeCompare(b));
  const sorted = entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  // take VALUES only, joined by '&'
  const values = sorted.map(([, v]) => String(v));
  const toSign = [integritySalt, ...values].join("&");
  console.log("To sign is: ", toSign)
  return crypto
    .createHmac("sha256", integritySalt)
    .update(toSign, "utf8").digest("hex")
    .toUpperCase();
}



/** ---- validation ---- */
const initiateSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'amount must be numeric, max 2 decimals'),
  mobileNumber: z.string().regex(/^03\d{9}$/, 'mobile must be Pakistani msisdn like 03xxxxxxxxx'),
  cnicLast6: z.string().regex(/^\d{6}$/, 'CNIC last 6 required'),
  billRef: z.string().max(20).optional(),
  description: z.string().max(255).optional()
});

export function generateTxnRefNo() {
  const base = Date.now().toString().slice(-13); // last 13 digits of epoch ms
  const random3 = Math.floor(100 + Math.random() * 900); // 3 random digits
  return `T${base.slice(0, 13 - 3)}${random3}`.slice(0, 17); // ensure 17 chars
}

router.post('/api/payment/jazzcash/rest/init', async (req, res) => {
  
    const { amount, mobileNumber, cnicLast6, billRef, description } = initiateSchema.parse(req.body);
    Jazzcash.credentials({
      config: {
        merchantId: cfg.merchantId,
        password: cfg.password,
        hashKey: cfg.integritySalt
      },
      environment: 'sandbox' // available environment live or sandbox
    });

    Jazzcash.setData({
      pp_Amount: amount,
      pp_Version: '2.0',
      pp_TxnType: 'MWALLET',
      pp_BillReference: "billRef123",
      pp_Description: "Test Payment",
      pp_MobileNumber: "03123456789",
      pp_CNIC: "345678",
    });

    Jazzcash.createRequest("WALLET").then((res) => {
      res = JSON.parse(res);
      console.log(res);
    });
  }
)

/** ---- route: initiate Mobile Wallet payment ---- */
router.post('/api/payment/jazzcash/rest/initiate', async (req, res) => {
  try {
    const { amount, mobileNumber, cnicLast6, billRef, description } = initiateSchema.parse(req.body);

    const now = new Date();
    const txnDateTime = formatDateTime(now);
    const expDateTime = formatDateTime(new Date(now.getTime() + 60 * 60 * 1000)); // +60 min
    const txnRefNo = `T${txnDateTime}`;

    // Build request fields
    const pp = {
      pp_Version: '2.0',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: cfg.merchantId,
      pp_Password: cfg.password,
      // Per common MWALLET examples for sandbox:
      pp_TxnRefNo: generateTxnRefNo(),
      pp_Amount: pkrToPaisa(amount), // minor units
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: txnDateTime,
      pp_BillReference: 'billRef',
      pp_Description: 'Description of transaction',
      pp_ReturnURL: cfg.returnUrl,
      pp_SecureHashType: "SHA256",

      // MWALLET specifics
      pp_MobileNumber: mobileNumber,
      pp_CNIC: cnicLast6,
      // ppmpf_1: "1",
      // ppmpf_2: "2",
      // ppmpf_3: "3",
      // ppmpf_4: "4",
      // ppmpf_5: "5",
    };
    
    const pp_SecureHash = makeSecureHash(pp, cfg.integritySalt); // HMAC-SHA256 per JazzCash docs. 
    // :contentReference[oaicite:5]{index=5}
    console.log("Hash is: ", pp_SecureHash)
    // Many working integrations send x-www-form-urlencoded. We'll do that for MWALLET.
    const form = qs.stringify({...pp, pp_SecureHash});

    const { data } = await axios.post(JC_MWALLET_URL, form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // Important: timeouts & TLS options can be tuned here
      timeout: 20000
    });

    // JazzCash returns JSON-ish object for REST v2.0; success for MWALLET is pp_ResponseCode === '000'. :contentReference[oaicite:6]{index=6}
    res.json({ ok: true, request: { txnRefNo, amountMinor: pp.pp_Amount }, response: data });
  } catch (err) {
    if (err?.issues) {
      return res.status(400).json({ ok: false, error: 'validation_error', details: err.issues });
    }
    console.error(err);
    res.status(500).json({ ok: false, error: 'jazzcash_request_failed', message: String(err.message || err) });
  }
});

export default router;