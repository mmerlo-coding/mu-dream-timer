export const SERVER_UTC_OFFSET_HOURS = 2;
export const NOTIFY_MINUTES = 5;

export function getServerNow(): Date {
  return new Date();
}

export function toServerDate(date: Date) {
  const shifted = new Date(date.getTime() + SERVER_UTC_OFFSET_HOURS * 60 * 60 * 1000);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function fromServerParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const utcMs = Date.UTC(year, month, day, hour, minute);
  return new Date(utcMs - SERVER_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

export function formatServerDateTime(date: Date) {
  const parts = toServerDate(date);
  const day = String(parts.day).padStart(2, "0");
  const month = String(parts.month + 1).padStart(2, "0");
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");

  return `${day}/${month} ${hour}:${minute} (UTC+2)`;
}

export function formatDuration(ms: number) {
  if (ms <= 0) return "ahora";

  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function parseTimeString(time: string) {
  const [hourText, minuteText] = time.split(":");
  return {
    hour: Number(hourText),
    minute: Number(minuteText),
  };
}
