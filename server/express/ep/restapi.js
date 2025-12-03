import express from "express";
import axios from "axios";
import z from "zod";

const router = express.Router();

/** ---- Easypaisa REST / Direct API config ----
 *
 * You’ll need from Easypaisa:
 * - OpenAPI Username
 * - OpenAPI Password
 * - Store ID
 *
 * These are the same ones WHMCS & others call “Open API Username / Password”
 * and “Store ID”. 
 */
const EP_ENV = process.env.EASYPAISA_ENVIRONMENT || "sandbox";

const EP_BASE_URL =
  EP_ENV === "production"
    ? "https://easypay.easypaisa.com.pk"
    : "https://easypaystg.easypaisa.com.pk";

// MA = Mobile Account transaction endpoint. 
const EP_MA_URL = `${EP_BASE_URL}/easypay-service/rest/v4/initiate-ma-transaction`;

const cfg = {
  storeId: process.env.EASYPAY_STORE_ID,
  username: process.env.EASYPAY_USERNAME, // OpenAPI Username
  password: process.env.EASYPAY_PASSWORD, // OpenAPI Password
};

// For sandbox: test transactions are usually fixed at 10.0 PKR and use a test MSISDN
// provided by Easypaisa. 

/** ---- validation ---- */
const initiateSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "amount must be numeric, max 2 decimals"),
  mobileNumber: z
    .string()
    .regex(/^03\d{9}$/, "mobile must be Pakistani msisdn like 03xxxxxxxxx"),
  email: z
    .string()
    .email("valid email required")
    .max(255),
  orderId: z
    .string()
    .max(20, "orderId max length 20 (per Easypaisa docs)") // aligns with examples 
});

/**
 * Helper: build base64 credentials header
 */
function buildCredentialsHeader(username, password) {
  if (!username || !password) {
    throw new Error("Easypaisa username/password (OpenAPI credentials) missing");
  }
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `base64(${token})`; // Some docs show just Base64, others prefix; if they say plain Base64, drop "base64()"
}

/**
 * route: initiate Mobile Account (MA) transaction
 *
 * This is analogous to your JazzCash MWALLET route, but for Easypaisa.
 */
router.post("/api/payment/easypaisa/rest/initiate", async (req, res) => {
  try {
    const { amount, mobileNumber, email, orderId } = initiateSchema.parse(
      req.body
    );

    if (!cfg.storeId) {
      return res
        .status(500)
        .json({ ok: false, error: "Easypaisa STORE_ID not configured" });
    }

    const transactionAmount = Number(amount);
    if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "invalid_amount",
        message: "Amount must be a positive number",
      });
    }

    // Build Easypaisa request body for MA REST API
    // Fields based on official & community examples. 
    const body = {
      emailAddress: email,
      mobileAccountNo: mobileNumber,
      orderId, // your own reference, max 20 chars
      storeId: cfg.storeId,
      transactionAmount, // e.g. 10.0 (last two digits as decimals)
      transactionType: "MA", // Mobile Account
    };

    const credentials = buildCredentialsHeader(cfg.username, cfg.password);

    const { data } = await axios.post(EP_MA_URL, body, {
      headers: {
        Credentials: credentials,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    });

    // Expected response (from Laravel pkg & examples):
    // {
    //   "responseCode": "0000",
    //   "responseDesc": "Success",
    //   "transactionId": "....",
    //   "orderId": "XYZ123",
    //   ...
    // } 
    const responseCode = data?.responseCode;
    const ok = responseCode === "0000";

    return res.json({
      ok,
      request: {
        orderId,
        amount: transactionAmount,
        mobileNumber,
      },
      response: data,
    });
  } catch (err) {
    if (err?.issues) {
      // zod validation error
      return res.status(400).json({
        ok: false,
        error: "validation_error",
        details: err.issues,
      });
    }
    console.error("Easypaisa MA request error:", err);
    return res.status(500).json({
      ok: false,
      error: "easypaisa_request_failed",
      message: String(err.message || err),
    });
  }
});

export default router;
