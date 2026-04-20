export const STATE_OPTIONS = ['TN'] as const;

export function isSupportedState(
  value: unknown
): value is (typeof STATE_OPTIONS)[number] {
  return value === 'TN';
}

export const TIME_HOUR_OPTIONS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
] as const;

export const TIME_MINUTE_OPTIONS = ['00', '15', '30', '45'] as const;

export const TIME_MERIDIEM_OPTIONS = ['AM', 'PM'] as const;

export type TimeHour = (typeof TIME_HOUR_OPTIONS)[number];
export type TimeMinute = (typeof TIME_MINUTE_OPTIONS)[number];
export type TimeMeridiem = (typeof TIME_MERIDIEM_OPTIONS)[number];

export function isSupportedTimeHour(value: unknown): value is TimeHour {
  return TIME_HOUR_OPTIONS.includes(value as TimeHour);
}

export function isSupportedTimeMinute(value: unknown): value is TimeMinute {
  return TIME_MINUTE_OPTIONS.includes(value as TimeMinute);
}

export function isSupportedTimeMeridiem(value: unknown): value is TimeMeridiem {
  return TIME_MERIDIEM_OPTIONS.includes(value as TimeMeridiem);
}

export function formatTimeFromParts(
  hour: TimeHour,
  minute: TimeMinute,
  meridiem: TimeMeridiem
): string {
  return `${hour}:${minute} ${meridiem}`;
}

export function buildHoursRange(openTime: string, closeTime: string): string {
  return `${openTime} - ${closeTime}`;
}

export function parseHoursRange(hours: string): {
  openHour: TimeHour;
  openMinute: TimeMinute;
  openMeridiem: TimeMeridiem;
  closeHour: TimeHour;
  closeMinute: TimeMinute;
  closeMeridiem: TimeMeridiem;
} | null {
  const match = hours.match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );

  if (!match) {
    return null;
  }

  const [
    ,
    rawOpenHour,
    rawOpenMinute,
    rawOpenMeridiem,
    rawCloseHour,
    rawCloseMinute,
    rawCloseMeridiem,
  ] = match;
  const openHour = String(Number(rawOpenHour));
  const closeHour = String(Number(rawCloseHour));
  const openMinute = rawOpenMinute;
  const closeMinute = rawCloseMinute;
  const openMeridiem = rawOpenMeridiem.toUpperCase();
  const closeMeridiem = rawCloseMeridiem.toUpperCase();

  if (
    !isSupportedTimeHour(openHour) ||
    !isSupportedTimeMinute(openMinute) ||
    !isSupportedTimeMeridiem(openMeridiem) ||
    !isSupportedTimeHour(closeHour) ||
    !isSupportedTimeMinute(closeMinute) ||
    !isSupportedTimeMeridiem(closeMeridiem)
  ) {
    return null;
  }

  return {
    openHour,
    openMinute,
    openMeridiem,
    closeHour,
    closeMinute,
    closeMeridiem,
  };
}

export function isSupportedHours(value: string): boolean {
  return parseHoursRange(value) !== null;
}
