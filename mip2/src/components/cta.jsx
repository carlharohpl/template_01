import React from "react";

// AppLovin MIP click-through: window.__mip.openClickthrough() (defined in
// index.html's raw inline script) does the actual click-target resolution,
// mraid.open() guard, and try/catch — kept there so the validator-scanned
// literal text survives Vite's minifier. See CLAUDE.md before touching this.
// eslint-disable-next-line react-refresh/only-export-components -- reused outside this file (see CLAUDE.md)
export const openClickthrough = () => {
  window.__mip.openClickthrough();
};

export const Cta = ({ className = "" }) => (
  <button
    type="button"
    className={className}
    onClick={(event) => {
      event.stopPropagation();
      openClickthrough();
    }}
  >
    Shop Now
  </button>
);
