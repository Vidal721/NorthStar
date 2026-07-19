import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installApiFetchDefaults } from './apiConfig.js'
import { registerSW } from 'virtual:pwa-register' // 1. Import the PWA register helper

installApiFetchDefaults()

// 2. Automatically refresh the browser tab when a new deployment is detected
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
