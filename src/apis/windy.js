// Open-Meteo Weather + Marine API Adapter
// Replaces Windy Point Forecast API to avoid trial key randomized data restrictions.
//
// We fetch:
//   - Weather Forecast API: temp, wind, windGust, rh, pressure, precip, cloud
//   - Marine API: waveHeight, wavePeriod, waveDirection, windWaveHeight, swell1Height
// Both use unixtime for perfect alignment.

export async function fetchWindy(env, lat, lon) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,precipitation,cloud_cover,wind_speed_10m,wind_gusts_10m&wind_speed_unit=ms&timeformat=unixtime&forecast_days=1`;
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height&timeformat=unixtime&forecast_days=1`;

  const [weatherRes, marineRes] = await Promise.all([
    fetch(weatherUrl).then(r => {
      if (!r.ok) throw new Error(`OpenMeteoWeather ${r.status}`);
      return r.json();
    }),
    fetch(marineUrl).then(r => {
      if (!r.ok) throw new Error(`OpenMeteoMarine ${r.status}`);
      return r.json();
    })
  ]);

  const wHourly = weatherRes.hourly || {};
  const mHourly = marineRes.hourly || {};
  const ts = (wHourly.time || []).map(t => t * 1000);

  return {
    ts,
    units: {
      temp: "°C",
      wind: "m/s",
      windGust: "m/s",
      humidity: "%",
      pressure: "hPa",
      precip: "mm",
      cloud: "%",
      waveHeight: "m",
      wavePeriod: "s",
      waveDirection: "°"
    },
    temp: wHourly.temperature_2m || [],
    wind: wHourly.wind_speed_10m || [],
    windGust: wHourly.wind_gusts_10m || [],
    rh: wHourly.relative_humidity_2m || [],
    pressure: wHourly.surface_pressure || [],
    precip: wHourly.precipitation || [],
    cloud: wHourly.cloud_cover || [],
    waveHeight: mHourly.wave_height || [],
    wavePeriod: mHourly.wave_period || [],
    waveDirection: mHourly.wave_direction || [],
    windWaveHeight: mHourly.wind_wave_height || [],
    swell1Height: mHourly.swell_wave_height || []
  };
}
