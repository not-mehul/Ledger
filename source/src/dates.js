// Converts an ISO week string ("2024-W14") to the date of that week's Monday ("2024-04-01").
// Only entries written by an earlier build (which used <input type="week">) carry this format.
export function isoWeekToDate(value) {
  const [yearStr, weekStr] = value.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (week - 1) * 7);
  return monday.toISOString().split("T")[0];
}

// "2024-04" -> "April 2024"
export function formatMonth(value) {
  if (!value) return "";
  if (value.includes("-W")) value = isoWeekToDate(value);
  const parts = value.split("-");
  return parts.length >= 2
    ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1).toLocaleDateString(
        "en-US",
        { year: "numeric", month: "long" },
      )
    : value;
}
