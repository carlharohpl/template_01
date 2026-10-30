import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

let creativeInitialized = false

function init() {
  if (creativeInitialized) return
  creativeInitialized = true

  window.__mip.setupMediaViewability()
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

window.__mip.ready(init)
