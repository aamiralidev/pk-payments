import { useState } from 'react';

export default function JazzCashMWalletForm() {
  const [amount, setAmount] = useState('15.00');
  const [mobile, setMobile] = useState('03123456789');
  const [cnicLast6, setCnicLast6] = useState('345678');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const resp = await fetch('https://atelic-eyeless-kristina.ngrok-free.dev/api/payment/jazzcash/rest/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          mobileNumber: mobile,
          cnicLast6
        })
      });
      const data = await resp.json();
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h2>JazzCash MWALLET (REST v2.0) — Sandbox</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Amount (PKR)
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 10.00"
            required
            style={{ width: '100%', padding: 8 }}
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
            style={{ width: '100%', padding: 8 }}
          />
        </label>
        <label>
          CNIC last 6
          <input
            type="text"
            value={cnicLast6}
            onChange={(e) => setCnicLast6(e.target.value)}
            placeholder="123456"
            required
            maxLength={6}
            style={{ width: '100%', padding: 8 }}
          />
        </label>

        <button disabled={submitting} type="submit" style={{ padding: '10px 14px', cursor: 'pointer' }}>
          {submitting ? 'Submitting…' : 'Pay with JazzCash'}
        </button>
      </form>

      {result && (
        <pre style={{ padding: 12, marginTop: 16, overflowX: 'auto', textAlign: 'start' }}>
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
