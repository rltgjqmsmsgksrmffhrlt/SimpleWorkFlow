// Fixed parts of the day that nobody enters by hand: lunch and the standing
// meetings. They are derived from these rules at render time, never stored.

// Korean public holidays, filled in through 2026-10-09 (incl. substitute days).
// Dates that merely fall on a weekend are listed for completeness; the weekend
// check already excludes them.
export const HOLIDAYS = new Set([
  "2026-08-15", // 광복절 (토)
  "2026-08-17", // 광복절 대체공휴일 (월)
  "2026-09-24", // 추석 연휴
  "2026-09-25", // 추석
  "2026-09-26", // 추석 연휴 (토)
  "2026-10-03", // 개천절 (토)
  "2026-10-05", // 개천절 대체공휴일 (월)
  "2026-10-09", // 한글날 (금)
]);

function toDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isBusinessDay(dateStr) {
  const day = toDate(dateStr).getDay();
  if (day === 0 || day === 6) return false;
  return !HOLIDAYS.has(dateStr);
}

// Monday-based week containing dateStr.
function weekDays(dateStr) {
  const d = toDate(dateStr);
  const offsetToMonday = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - offsetToMonday);
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    days.push(toStr(x));
  }
  return days;
}

export function isFirstBusinessDayOfWeek(dateStr) {
  const business = weekDays(dateStr).filter(isBusinessDay);
  return business.length > 0 && business[0] === dateStr;
}

export function isLastBusinessDayOfWeek(dateStr) {
  const business = weekDays(dateStr).filter(isBusinessDay);
  return business.length > 0 && business[business.length - 1] === dateStr;
}

export const LUNCH = { start: "13:00", end: "14:00", label: "점심시간" };

// Standing meetings that apply to every course.
export function fixedMeetingsFor(dateStr) {
  if (!isBusinessDay(dateStr)) return [];
  const out = [{ id: "lead-daily", start: "09:30", end: "10:30", label: "팀장 미팅" }];
  if (isFirstBusinessDayOfWeek(dateStr)) {
    out.push({ id: "all-hands", start: "15:00", end: "16:00", label: "전체 미팅" });
  }
  if (isLastBusinessDayOfWeek(dateStr)) {
    out.push({ id: "lead-weekly", start: "16:00", end: "17:00", label: "팀장 주간회의" });
  }
  return out;
}
