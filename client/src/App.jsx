import './App.css'
import CheckoutButton from './components/CheckoutButton'
import JazzCashMWalletForm from './components/JazzCashMWalletForm'

function App() {

  return (
    <>
      <CheckoutButton amountPKR={110} orderId={"abc-123"}/>
      <JazzCashMWalletForm />
    </>
  )
}

export default App
