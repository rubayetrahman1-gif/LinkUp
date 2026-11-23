const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
  const normalizedValue =
    !hasTimezone && /^\d{4}-\d{2}-\d{2}T/.test(value) ? `${value}Z` : value;
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : "Date unavailable";
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? dateTimeFormatter.format(date) : "Time unavailable";
}
