import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// AppLovin MIP: don't initialize layout, interaction, media playback, or
// orientation handling until MRAID is out of the "loading" state.
// window.__mip.ready/setupMediaViewability are defined in index.html's raw
// inline scripts — see CLAUDE.md before reimplementing any of this here.
let creativeInitialized = false;

function init() {
  if (creativeInitialized) return;
  creativeInitialized = true;

  window.__mip.setupMediaViewability();

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

window.__mip.ready(init);
