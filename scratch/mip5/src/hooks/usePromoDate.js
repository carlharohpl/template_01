import { useEffect, useState } from "react";

const formatDate = () => new Date().toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
}).toUpperCase();

export default function usePromoDate() {
  const [promoDate, setPromoDate] = useState(formatDate);

  useEffect(() => {
    let midnightTimer;
    const scheduleMidnight = () => {
      window.clearTimeout(midnightTimer);
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 50);
      midnightTimer = window.setTimeout(refreshDate, midnight.getTime() - now.getTime());
    };
    const refreshDate = () => {
      setPromoDate(formatDate());
      scheduleMidnight();
    };
    const handleVisibility = () => {
      if (!document.hidden) refreshDate();
    };
    scheduleMidnight();
    window.addEventListener("focus", refreshDate);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", refreshDate);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return promoDate;
}
