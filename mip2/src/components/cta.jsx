import React from "react";

// AppLovin MIP navigation: window.__mip.openDestination() (defined in
// index.html's raw inline script) does the actual click-target resolution,
// mraid.open(destinationUrl) guard, and try/catch — kept there so the validator-scanned
// literal text survives Vite's minifier. See CLAUDE.md before touching this.
// eslint-disable-next-line react-refresh/only-export-components -- reused outside this file (see CLAUDE.md)
export const openDestination = () => {
  console.log("CTA clicked");
  window.__mip.openDestination();
};

export const Cta = () => (
  <button
    type="button"
    aria-label="Open offer"
    onClick={(event) => {
      event.stopPropagation();
      openDestination();
    }}
  />
);
