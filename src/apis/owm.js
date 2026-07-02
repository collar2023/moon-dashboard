// OpenWeatherMap - free tier
//   /data/2.5/weather   - current conditions
//   /data/2.5/forecast  - 5 day / 3 hour forecast

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OWM ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchOWMCurrent(env, lat, lon) {
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("appid", env.OWM_API_KEY);
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "zh_cn");
  return fetchJSON(url.toString());
}

export async function fetchOWM(env, lat, lon) {
  const base = "https://api.openweathermap.org/data/2.5";
  const u = (p) => {
    const url = new URL(base + p);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("appid", env.OWM_API_KEY);
    url.searchParams.set("units", "metric");
    url.searchParams.set("lang", "zh_cn");
    return url.toString();
  };

  const [current, forecast] = await Promise.all([
    fetchJSON(u("/weather")),
    fetchJSON(u("/forecast"))
  ]);

  // Normalize: derive an "hourly" array from forecast.list
  const hourly = forecast.list.map((it) => ({
    dt: it.dt,
    temp: it.main.temp,
    feels_like: it.main.feels_like,
    humidity: it.main.humidity,
    pressure: it.main.pressure,
    weather: it.weather,
    wind_speed: it.wind?.speed,
    wind_deg: it.wind?.deg,
    pop: it.pop ?? 0,
    rain: it.rain?.["3h"] || 0
  }));

  return { current, hourly, daily: [] };
}
