// components/EasypaisaMAForm.jsx
import { useState } from "react";

export default function EasypaisaMAForm() {
  const [amount, setAmount] = useState("10.0");
  const [mobile, setMobile] = useState("03123456789");
  const [email, setEmail] = useState("test@example.com");
  const [orderId, setOrderId] = useState("EP-ORDER-001");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const resp = await fetch(
        // You can replace with your ngrok or VITE_API_BASE_URL if you want
        "http://localhost:3001/api/payment/easypaisa/rest/initiate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            mobileNumber: mobile,
            email,
            orderId,
          }),
        }
      );

      const data = await resp.json();
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "40px auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2>Easypaisa Mobile Account (REST) — Sandbox</h2>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <label>
          Amount (PKR)
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 10.0"
            required
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          Mobile (03xxxxxxxxx)
          <input
            type="text"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="03xxxxxxxxx"
            required
            maxLength={11}
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          Order ID (max 20 chars)
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="EP-ORDER-001"
            required
            maxLength={20}
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <button
          disabled={submitting}
          type="submit"
          style={{ padding: "10px 14px", cursor: "pointer" }}
        >
          {submitting ? "Submitting…" : "Pay with Easypaisa (MA)"}
        </button>
      </form>

      {result && (
        <pre
          style={{
            padding: 12,
            marginTop: 16,
            overflowX: "auto",
            textAlign: "start",
          }}
        >
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
