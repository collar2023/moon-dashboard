var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/apis/windy.js
var WINDY_URL = "https://api.windy.com/api/point-forecast/v2";
async function fetchWindy(env, lat, lon) {
  const params = [
    "wind",
    "windGust",
    "temp",
    "precip",
    "cloud",
    "humidity",
    "pressure",
    "waveHeight",
    "wavePeriod",
    "waveDirection"
  ].join(",");
  const body = {
    lat: Number(lat),
    lon: Number(lon),
    model: "iconEu",
    parameters: params,
    levels: "surface",
    key: env.WINDY_API_KEY
  };
  const res = await fetch(WINDY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Windy ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}
__name(fetchWindy, "fetchWindy");

// src/apis/owm.js
var OWM_URL = "https://api.openweathermap.org/data/3.0/onecall";
async function fetchOWM(env, lat, lon) {
  const url = new URL(OWM_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("appid", env.OWM_API_KEY);
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "zh_cn");
  url.searchParams.set("exclude", "minutely");
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OWM ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}
__name(fetchOWM, "fetchOWM");

// src/apis/astro.js
var SUN_URL = "https://api.sunrise-sunset.org/json";
async function fetchSun(lat, lon, dateISO) {
  const url = new URL(SUN_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("date", dateISO || "today");
  url.searchParams.set("formatted", "0");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Sun ${res.status}`);
  const data = await res.json();
  if (data.status !== "OK") throw new Error(`Sun status: ${data.status}`);
  return data.results;
}
__name(fetchSun, "fetchSun");

// src/cache.js
async function cacheGet(env, key) {
  try {
    const raw = await env.CACHE_KV.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
__name(cacheGet, "cacheGet");
async function cachePut(env, key, value, ttlSec) {
  const payload = JSON.stringify({ v: value, e: Date.now() + ttlSec * 1e3 });
  await env.CACHE_KV.put(key, payload, { expirationTtl: ttlSec });
}
__name(cachePut, "cachePut");
async function cacheGetFresh(env, key) {
  const raw = await cacheGet(env, key);
  if (!raw) return null;
  if (raw.e && raw.e < Date.now()) return null;
  return raw.v;
}
__name(cacheGetFresh, "cacheGetFresh");

// src/index.js
var LAT = 22.6;
var LON = 114.9;
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var JSON_HEADERS = {
  ...CORS,
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=180"
};
async function handleNow(env) {
  const cacheKey = `now:${LAT}:${LON}`;
  const cached = await cacheGetFresh(env, cacheKey);
  if (cached) return json(cached);
  const [windy, owm, sun] = await Promise.allSettled([
    fetchWindy(env, LAT, LON),
    fetchOWM(env, LAT, LON),
    fetchSun(LAT, LON, "today")
  ]);
  const merged = {
    ts: Date.now(),
    location: { lat: LAT, lon: LON, name: "\u53CC\u6708\u6E7E" },
    windy: windy.status === "fulfilled" ? extractWindy(windy.value) : { error: windy.reason?.message },
    owm: owm.status === "fulfilled" ? extractOWM(owm.value) : { error: owm.reason?.message },
    sun: sun.status === "fulfilled" ? sun.value : { error: sun.reason?.message }
  };
  await cachePut(env, cacheKey, merged, 600);
  return json(merged);
}
__name(handleNow, "handleNow");
async function handleForecast(request, env) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "daily" ? "daily" : "hourly";
  const cacheKey = `forecast:${LAT}:${LON}:${type}`;
  const cached = await cacheGetFresh(env, cacheKey);
  if (cached) return json(cached);
  const owm = await fetchOWM(env, LAT, LON);
  const data = type === "daily" ? { ts: Date.now(), type, daily: (owm.daily || []).slice(0, 8) } : { ts: Date.now(), type, hourly: (owm.hourly || []).slice(0, 48) };
  const ttl = type === "daily" ? 3 * 3600 : 3600;
  await cachePut(env, cacheKey, data, ttl);
  return json(data);
}
__name(handleForecast, "handleForecast");
async function handleAstro(request, env) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "today";
  const cacheKey = `astro:${LAT}:${LON}:${date}`;
  const cached = await cacheGetFresh(env, cacheKey);
  if (cached) return json(cached);
  const sun = await fetchSun(LAT, LON, date);
  const data = { ts: Date.now(), date, sun };
  await cachePut(env, cacheKey, data, 24 * 3600);
  return json(data);
}
__name(handleAstro, "handleAstro");
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}
__name(json, "json");
function extractWindy(w) {
  if (!w || !Array.isArray(w.ts) || w.ts.length === 0) return null;
  const get = /* @__PURE__ */ __name((k) => w[k] || w[k + "-surface"] || w["wind-surface"], "get");
  return {
    ts: w.ts.slice(0, 6),
    units: w.units || {},
    wind: (w["wind-surface"] || w.wind || []).slice(0, 6),
    windGust: (w["gust-surface"] || w.windGust || []).slice(0, 6),
    temp: (w["temp-surface"] || w.temp || []).slice(0, 6),
    precip: (w["precip-surface"] || w.precip || []).slice(0, 6),
    cloud: (w["cloud-surface"] || w.cloud || []).slice(0, 6),
    humidity: (w["rh-surface"] || w.humidity || []).slice(0, 6),
    pressure: (w["pressure-surface"] || w.pressure || []).slice(0, 6),
    waveHeight: (w["waves-surface"] || w.waveHeight || []).slice(0, 6),
    wavePeriod: (w["waves-period-surface"] || w.wavePeriod || []).slice(0, 6),
    waveDirection: (w["waves-direction-surface"] || w.waveDirection || []).slice(0, 6)
  };
}
__name(extractWindy, "extractWindy");
function extractOWM(o) {
  return {
    current: o.current,
    hourly: o.hourly ? o.hourly.slice(0, 24) : [],
    daily: o.daily ? o.daily.slice(0, 7) : [],
    alerts: o.alerts || []
  };
}
__name(extractOWM, "extractOWM");
var index_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/now" && request.method === "GET") return await handleNow(env);
      if (path === "/api/forecast" && request.method === "GET") return await handleForecast(request, env);
      if (path === "/api/astro" && request.method === "GET") return await handleAstro(request, env);
      if (path === "/api/health") return json({ ok: true, ts: Date.now() });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
