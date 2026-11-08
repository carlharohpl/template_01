import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { openDestination } from "./components/cta.jsx";
import { language } from "./localization.js";

// AppLovin MIP: don't initialize layout, interaction, media playback, or
// orientation handling until MRAID is out of the "loading" state.
// window.__mip.ready/setupMediaViewability are defined in index.html's raw
// inline scripts — see CLAUDE.md before reimplementing any of this here.
let creativeInitialized = false;
let root;
let disposeMedia;
window.__mip.activateDestination = openDestination;
window.__mip.language = language;

function init() {
  if (creativeInitialized) return;
  creativeInitialized = true;

  disposeMedia = window.__mip.setupMediaViewability();

  root = createRoot(document.getElementById("root"));
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

const cancelReady = window.__mip.ready(init);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelReady?.();
    disposeMedia?.();
    window.isMraidUsable.dispose?.();
    root?.unmount();
    if (window.__mip.activateDestination === openDestination) delete window.__mip.activateDestination;
    if (window.__mip.language === language) delete window.__mip.language;
  });
}
