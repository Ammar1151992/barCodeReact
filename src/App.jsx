import BarcodeScanner from './components/BarcodeScanner'
import './App.css'

function App() {
  return (
    <div className="app" dir="rtl">
      <h1>ماسح الباركود والآيماي</h1>
      <BarcodeScanner />
    </div>
  )
}

export default App
