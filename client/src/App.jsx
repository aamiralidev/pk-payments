// app.jsx
import "./App.css";
import JazzCashCheckoutButton from "./components/JazzCashCheckoutButton";
import JazzCashMWalletForm from "./components/JazzCashMWalletForm";
import EasypaisaCheckoutButton from "./components/EasypaisaCheckoutButton";
import EasypaisaMAForm from "./components/EasypaisaMAForm"; // 🆕 import

function App() {
  return (
    <>
      <h2>Hosted Checkout Tests</h2>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <JazzCashCheckoutButton amountPKR={110} orderId={"abc-123"} />
        <EasypaisaCheckoutButton amountPKR={110} orderRefNum={"abc-123"} />
      </div>

      <h2>REST API (MWALLET / MA) Tests</h2>

      {/* JazzCash MWALLET */}
      <JazzCashMWalletForm />

      {/* Easypaisa Mobile Account REST */}
      <EasypaisaMAForm />
    </>
  );
}

export default App;
