import { openDestination } from "../components/cta";

export function handleMraidClick() { openDestination(); }

export function setupMraidViewability(handleViewableChange) {
  if (typeof window === "undefined" || !window.mraid) return undefined;
  try {
    if (typeof window.mraid.isViewable === "function") handleViewableChange(window.mraid.isViewable());
    if (typeof window.mraid.addEventListener !== "function" || typeof window.mraid.removeEventListener !== "function") return undefined;
    const remove = window.mraid.removeEventListener.bind(window.mraid, "viewableChange", handleViewableChange);
    window.mraid.addEventListener("viewableChange", handleViewableChange);
    return () => { try { remove(); } catch { /* Host disposed. */ } };
  } catch { return undefined; }
}
