// components/EasypaisaCheckoutButton.jsx
import React from "react";
import { payWithEasypaisaHosted } from "../lib/payment/easypaisa/hosted";

export default function EasypaisaCheckoutButton({ amountPKR, orderRefNum }) {
  const onPay = async () => {
    await payWithEasypaisaHosted(
      {
        amountPKR,
        orderRefNum,
        emailAddr: "test@example.com",    // optional – you can wire real values later
        mobileNum: "03001234567",         // optional
        autoRedirect: "1",                // default; you can omit
      },
      {
        baseUrl: import.meta.env.VITE_API_BASE_URL,
        onBeforeRedirect: () => {
          console.log("Redirecting to Easypaisa…");
        },
        onError: (e) => {
          console.error(e);
          alert("Could not start Easypaisa payment. Please try again.");
        },
      }
    );
  };

  return <button onClick={onPay}>Pay with Easypaisa</button>;
}
