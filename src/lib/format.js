// Money is integer USD cents everywhere. Never floats, never client-computed
// prices — these helpers only format what the server already decided.

export function formatUsd(cents) {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return "--";
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

/** Firestore Timestamp | ISO string | Date | null -> Date | null */
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = toDate(value);
  if (!d) return "--";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "--";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function formatDeliveryWindow(days) {
  if (!days) return "Delivery time varies";
  if (days <= 1) return "Usually delivered within a day";
  return `Usually delivered in ${days} days`;
}
