export type TimeState = 'sunrise' | 'day' | 'sunset' | 'night';

export function parseLocalDateTime(localTime?: string): Date | null {
  if (!localTime) {
    return null;
  }

  const parsed = new Date(localTime.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseClockTime(timeValue?: string): { hours24: number; minutes: number } | null {
  if (!timeValue) {
    return null;
  }

  try {
    const [timePart, period] = timeValue.split(' ');
    const [hours, minutes] = timePart.split(':').map(Number);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    let hours24 = hours;
    if (period === 'PM' && hours !== 12) {
      hours24 = hours + 12;
    } else if (period === 'AM' && hours === 12) {
      hours24 = 0;
    }

    return { hours24, minutes };
  } catch {
    return null;
  }
}

export function isWithinOneHour(currentDate: Date | null, targetTime?: string): boolean {
  if (!currentDate) {
    return false;
  }

  const parsedTargetTime = parseClockTime(targetTime);
  if (!parsedTargetTime) {
    return false;
  }

  const targetDate = new Date(currentDate);
  targetDate.setHours(parsedTargetTime.hours24, parsedTargetTime.minutes, 0, 0);

  const oneHourBefore = targetDate.getTime() - 60 * 60 * 1000;
  const oneHourAfter = targetDate.getTime() + 60 * 60 * 1000;
  const currentTimestamp = currentDate.getTime();

  return currentTimestamp >= oneHourBefore && currentTimestamp <= oneHourAfter;
}

export function getLiveLocalDate(
  currentTime: string | undefined,
  currentTimeEpoch: number | undefined,
  nowMs: number,
  fallbackSnapshotAtMs: number,
): Date | null {
  const snapshotDate = parseLocalDateTime(currentTime);
  if (!snapshotDate) {
    return null;
  }

  const snapshotEpochMs = typeof currentTimeEpoch === 'number'
    ? currentTimeEpoch * 1000
    : fallbackSnapshotAtMs;
  const elapsedMs = Math.max(0, nowMs - snapshotEpochMs);

  return new Date(snapshotDate.getTime() + elapsedMs);
}

export function getMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

export function getDaytimeProgress(
  currentDate: Date | null,
  sunriseTime?: string,
  sunsetTime?: string,
): number | undefined {
  if (!currentDate) {
    return undefined;
  }

  const sunrise = parseClockTime(sunriseTime);
  const sunset = parseClockTime(sunsetTime);
  if (!sunrise || !sunset) {
    return undefined;
  }

  const sunriseMinutes = sunrise.hours24 * 60 + sunrise.minutes;
  const sunsetMinutes = sunset.hours24 * 60 + sunset.minutes;
  const daylightDuration = sunsetMinutes - sunriseMinutes;
  if (daylightDuration <= 0) {
    return undefined;
  }

  return Math.max(
    0,
    Math.min(1, (getMinutesSinceMidnight(currentDate) - sunriseMinutes) / daylightDuration),
  );
}

export function getTimeState(
  isDay: number | undefined,
  sunsetTime: string | undefined,
  sunriseTime: string | undefined,
  currentDate: Date | null,
): TimeState {
  if (isWithinOneHour(currentDate, sunriseTime)) {
    return 'sunrise';
  }

  if (isDay === 0) {
    return 'night';
  }

  if (isWithinOneHour(currentDate, sunsetTime)) {
    return 'sunset';
  }

  return 'day';
}
