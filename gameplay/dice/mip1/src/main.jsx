import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { openDestination } from "./components/cta";

let initialized = false;
function init() {
  if (initialized) return;
  initialized = true;
  window.__mip.setupMediaViewability();
  window.__mip.activateDestination = openDestination;
  createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
}
window.__mip.ready(init);
