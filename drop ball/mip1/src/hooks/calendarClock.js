// Optional: import only for creatives with dynamic dates or holiday text.
// For those creatives, expose this module's calendarClock on
// window.__mip.calendarClock before rendering trusted same-origin end cards.
// Calendar content only. Animation, input, media, and elapsed timers keep
// their existing real-time sources.
export function parsePreviewDate(search) {
  const value = new URLSearchParams(search).get("date");
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function createCalendarClock(search) {
  const previewDate = parsePreviewDate(search);
  return Object.freeze({
    isPreview: previewDate !== null,
    now() {
      return previewDate ? new Date(previewDate.getTime()) : new Date();
    },
  });
}

export function readCalendarSearch() {
  if (typeof window === "undefined") return "";
  if (window.location.search) return window.location.search;
  try {
    if (window.parent !== window) return window.parent.location.search;
  } catch {
    // Isolated end cards must receive a validated date before rendering.
  }
  return "";
}

export function readAppLovinPreviewSearch() {
  try {
    if (typeof window === "undefined" || window.parent === window) return null;
    const preview = window.parent;
    const { protocol, hostname, pathname, origin, search } = preview.location;
    if (!/^https:$/.test(protocol) || hostname !== "playable.applovindemo.com" ||
      !/^\/Preview\/(?:index\.html|mobilePreview\.html)?$/i.test(pathname) ||
      window.location.origin !== origin || !window.location.pathname.startsWith("/phaser/")) {
      return null;
    }

    // Explicit creative parameters win. Preserve every existing date value,
    // including invalid/empty values that must keep normal fallback behavior.
    if (new URLSearchParams(window.location.search).has("date")) return window.location.search;
    const params = new URLSearchParams(search);
    if (!params.has("date")) {
      const url = Reflect.construct(URL, [preview.location.href]);
      url.searchParams.set("date", localDateKey(new Date()));
      preview.history.replaceState(preview.history.state, "", url.href);
      return url.search;
    }
    return search;
  } catch {
    // Restricted hosts/history access must never block the creative.
    return null;
  }
}

export function readLocalPreviewSearch() {
  try {
    if (typeof window === "undefined" || window.parent !== window) return null;
    const { protocol, hostname, search } = window.location;
    const local = protocol === "file:" ||
      (/^https?:$/.test(protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(hostname));
    if (!local) return null;
    if (new URLSearchParams(search).has("date")) return search;
    const url = Reflect.construct(URL, [window.location.href]);
    url.searchParams.set("date", localDateKey(new Date()));
    window.history.replaceState(window.history.state, "", url.href);
    return url.search;
  } catch {
    return null;
  }
}

function sharedCalendarClock() {
  // Trusted same-origin end cards that bundle this module reuse the actual
  // parent clock, even if the parent's URL changes after initial loading.
  try {
    if (typeof window !== "undefined" && window.parent !== window) {
      const clock = window.parent.__mip?.calendarClock;
      if (clock && typeof clock.now === "function" && typeof clock.isPreview === "boolean") {
        return clock;
      }
    }
  } catch {
    // No parent access: use this document's explicitly supplied parameter.
  }
  return createCalendarClock(readAppLovinPreviewSearch() ?? readLocalPreviewSearch() ?? readCalendarSearch());
}

// Evaluated once, before the React tree renders. Do not recreate on scene entry.
export const calendarClock = sharedCalendarClock();

export function localDateKey(date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function validateHolidayRanges(ranges) {
  if (!Array.isArray(ranges)) throw new Error("Holiday ranges must be an array.");
  for (const [index, range] of ranges.entries()) {
    if (!range || typeof range.startDate !== "string" || typeof range.endDate !== "string" ||
      !parsePreviewDate(new URLSearchParams({ date: range.startDate }).toString()) ||
      !parsePreviewDate(new URLSearchParams({ date: range.endDate }).toString()) ||
      range.startDate > range.endDate || typeof range.text !== "string") {
      throw new Error(`Invalid holiday range at index ${index}. Use valid inclusive YYYY-MM-DD dates and text.`);
    }
  }
}

export function holidayText(clock, ranges, defaultText = "") {
  validateHolidayRanges(ranges);
  const day = localDateKey(clock.now());
  // Configured order wins overlaps. Fixed ranges never repeat automatically.
  const match = ranges.find(range => range.startDate <= day && day <= range.endDate);
  return match ? match.text : defaultText;
}

export function subscribeCalendarClock(clock, onChange) {
  if (clock.isPreview) return () => {};

  let timer;
  let disposed = false;
  const refresh = () => {
    if (disposed) return;
    clearTimeout(timer);
    onChange(clock.now());
    // Always schedule with the real local clock, never a preview/offer date.
    const realNow = new Date();
    const midnight = new Date(realNow.getTime());
    midnight.setHours(24, 0, 0, 0);
    timer = setTimeout(refresh, Math.max(1, midnight.getTime() - realNow.getTime()));
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") refresh();
  };
  const onViewable = viewable => {
    if (viewable) refresh();
  };

  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("resume", refresh);
  const bridge = window.mraid;
  let listeningToBridge = false;
  try {
    if (window.isMraidUsable?.(bridge) && typeof bridge?.addEventListener === "function" &&
      typeof bridge?.removeEventListener === "function") {
      bridge.addEventListener("viewableChange", onViewable);
      listeningToBridge = true;
    }
  } catch {
    // Browser visibility and local-midnight refresh remain available.
  }
  refresh();

  return () => {
    disposed = true;
    clearTimeout(timer);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("pageshow", refresh);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("resume", refresh);
    if (listeningToBridge) {
      try { bridge.removeEventListener("viewableChange", onViewable); } catch { /* Host may have disposed its bridge. */ }
    }
  };
}
