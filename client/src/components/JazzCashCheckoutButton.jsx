// client/CheckoutButton.tsx
import React from "react";
import { payWithJazzcashHosted } from "../lib/payment/jazzcash/hosted";


export default function JazzCashCheckoutButton({ amountPKR, orderId }) {
  const onPay = async () => {
    await payWithJazzcashHosted(
      { amountPKR, orderId, description: `Order #${orderId}` },
      {
        baseUrl: import.meta.env.VITE_API_BASE_URL,
        onBeforeRedirect: () => {
          // optional: show a spinner/toast
          console.log("Redirecting to JazzCash…");
        },
        onError: (e) => {
          // optional: surface a nice error message
          console.error(e);
          alert("Could not start payment. Please try again.");
        },
      }
    );
  };

  return <button onClick={onPay}>Pay with JazzCash</button>;
}
