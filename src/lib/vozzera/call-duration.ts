const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatCallDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00";

  const totalSeconds = Math.floor(ms / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  if (hours === 0) return `${twoDigits(minutes)}:${twoDigits(seconds)}`;
  return `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
}
