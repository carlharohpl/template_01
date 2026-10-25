import { openClickthrough } from "../components/cta";

export const PlayableBridge = {
  ready() { window.gameReady?.(); window.mraid?.signalReady?.(); },
  end() { window.gameEnd?.(); },
  click: openClickthrough,
};
