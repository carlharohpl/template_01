import { useEffect, useState } from "react";
import { calendarClock, subscribeCalendarClock } from "./calendarClock";

const formatDate = () => calendarClock.now().toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
}).toUpperCase();

export default function usePromoDate() {
  const [promoDate, setPromoDate] = useState(formatDate);

  useEffect(() => subscribeCalendarClock(calendarClock, () => setPromoDate(formatDate())), []);

  return promoDate;
}
