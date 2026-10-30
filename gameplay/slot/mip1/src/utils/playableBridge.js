import { openDestination } from "../components/cta";

export const PlayableBridge = {
  ready() { window.gameReady?.(); window.mraid?.signalReady?.(); },
  end() { window.gameEnd?.(); },
  click: openDestination,
};
