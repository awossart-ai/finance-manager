/**
 * NOAA sunrise/sunset algorithm implementation
 */

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function getSunTimes(
  lat: number,
  lon: number,
  date: Date = new Date()
): { sunrise: Date; sunset: Date } {
  const defaultSunrise = new Date(date);
  defaultSunrise.setHours(6, 0, 0, 0);
  const defaultSunset = new Date(date);
  defaultSunset.setHours(20, 0, 0, 0);

  try {
    // Julian Day Number
    const JD = dateToJulian(date);

    // Julian century
    const T = (JD - 2451545.0) / 36525.0;

    // Geometric mean longitude of the sun (degrees)
    const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;

    // Geometric mean anomaly of the sun (degrees)
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);

    // Equation of center
    const C =
      Math.sin(toRad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
      Math.sin(toRad(2 * M)) * (0.019993 - 0.000101 * T) +
      Math.sin(toRad(3 * M)) * 0.000289;

    // Sun's true longitude
    const sunLon = L0 + C;

    // Sun's apparent longitude
    const omega = 125.04 - 1934.136 * T;
    const lambda = sunLon - 0.00569 - 0.00478 * Math.sin(toRad(omega));

    // Mean obliquity of the ecliptic
    const epsilon0 =
      23 +
      (26 + (21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813))) / 60) / 60;

    // Obliquity corrected
    const epsilon = epsilon0 + 0.00256 * Math.cos(toRad(omega));

    // Sun's declination
    const sinDec = Math.sin(toRad(epsilon)) * Math.sin(toRad(lambda));
    const dec = toDeg(Math.asin(sinDec));

    // Equation of time (minutes)
    const y = Math.tan(toRad(epsilon / 2)) ** 2;
    const eqTime =
      4 *
      toDeg(
        y * Math.sin(2 * toRad(L0)) -
          2 * 0.016708634 * Math.sin(toRad(M)) +
          4 * 0.016708634 * y * Math.sin(toRad(M)) * Math.cos(2 * toRad(L0)) -
          0.5 * y * y * Math.sin(4 * toRad(L0)) -
          1.25 * 0.016708634 * 0.016708634 * Math.sin(2 * toRad(M))
      );

    // Hour angle for sunrise/sunset
    const cosHourAngle =
      (Math.cos(toRad(90.833)) -
        Math.sin(toRad(lat)) * Math.sin(toRad(dec))) /
      (Math.cos(toRad(lat)) * Math.cos(toRad(dec)));

    // Polar day/night check
    if (cosHourAngle < -1 || cosHourAngle > 1) {
      return { sunrise: defaultSunrise, sunset: defaultSunset };
    }

    const hourAngle = toDeg(Math.acos(cosHourAngle));

    // Solar noon (UTC minutes)
    const solarNoon = 720 - 4 * lon - eqTime;

    // Sunrise/sunset (UTC minutes)
    const sunriseUTC = solarNoon - 4 * hourAngle;
    const sunsetUTC = solarNoon + 4 * hourAngle;

    const sunrise = new Date(date);
    sunrise.setUTCHours(0, 0, 0, 0);
    sunrise.setUTCMinutes(sunriseUTC);

    const sunset = new Date(date);
    sunset.setUTCHours(0, 0, 0, 0);
    sunset.setUTCMinutes(sunsetUTC);

    return { sunrise, sunset };
  } catch {
    return { sunrise: defaultSunrise, sunset: defaultSunset };
  }
}

function dateToJulian(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }

  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);

  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}
