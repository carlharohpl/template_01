import { openClickthrough } from "../components/cta";

export function handleMraidClick() { openClickthrough(); }

export function setupMraidViewability(handleViewableChange) {
  if (typeof window === "undefined") return undefined;

  const mraid = window.mraid;
  if (!mraid) return undefined;

  try {
    if (typeof mraid.isViewable === "function") {
      handleViewableChange(mraid.isViewable());
    }

    if (typeof mraid.addEventListener === "function") {
      mraid.addEventListener("viewableChange", handleViewableChange);

      return () => {
        if (typeof mraid.removeEventListener === "function") {
          mraid.removeEventListener("viewableChange", handleViewableChange);
        }
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}
