// 双月湾海边仪表盘 - Cloudflare Worker entry
// 聚合: Windy (point forecast) + OpenWeatherMap + Sunrise-Sunset

import { fetchWindy } from "./apis/windy.js";
import { fetchOWM, fetchOWMCurrent } from "./apis/owm.js";
import { fetchSun } from "./apis/astro.js";
import { cacheGetFresh, cachePut } from "./cache.js";

// 双月湾坐标 (港口/大星山一带)
const LAT = 22.6;
const LON = 114.9;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const JSON_HEADERS = {
  ...CORS,
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=180"
};

// === 路由处理 ===

async function handleNow(env) {
  const cacheKey = `now:${LAT}:${LON}`;
  const cached = await cacheGetFresh(env, cacheKey);
  if (cached) return json(cached);

  const [windy, owm, sun, liuyang, cancun, taiping] = await Promise.allSettled([
    fetchWindy(env, LAT, LON),
    fetchOWM(env, LAT, LON),
    fetchSun(LAT, LON),
    fetchOWMCurrent(env, 28.16, 113.63), // 湖南浏阳 (市政府驻地关口街道)
    fetchOWMCurrent(env, 21.16, -86.85), // 墨西哥坎昆
    fetchOWMCurrent(env, 24.95, 102.58)  // 昆明太平
  ]);

  const compare = [
    {
      name: "惠东双月湾",
      coords: `${LAT.toFixed(2)}°N, ${LON.toFixed(2)}°E`,
      weather: owm.status === "fulfilled" && owm.value.current ? (owm.value.current.weather?.[0]?.description || "--") : "--",
      temp: owm.status === "fulfilled" && owm.value.current ? owm.value.current.main?.temp : null,
      humidity: owm.status === "fulfilled" && owm.value.current ? owm.value.current.main?.humidity : null
    },
    {
      name: "墨西哥坎昆",
      coords: "21.16°N, 86.85°W",
      weather: cancun.status === "fulfilled" ? (cancun.value.weather?.[0]?.description || "--") : "--",
      temp: cancun.status === "fulfilled" ? cancun.value.main?.temp : null,
      humidity: cancun.status === "fulfilled" ? cancun.value.main?.humidity : null
    },
    {
      name: "昆明太平",
      coords: "24.95°N, 102.58°E",
      weather: taiping.status === "fulfilled" ? (taiping.value.weather?.[0]?.description || "--") : "--",
      temp: taiping.status === "fulfilled" ? taiping.value.main?.temp : null,
      humidity: taiping.status === "fulfilled" ? taiping.value.main?.humidity : null
    },
    {
      name: "湖南浏阳",
      coords: "28.16°N, 113.63°E",
      weather: liuyang.status === "fulfilled" ? (liuyang.value.weather?.[0]?.description || "--") : "--",
      temp: liuyang.status === "fulfilled" ? liuyang.value.main?.temp : null,
      humidity: liuyang.status === "fulfilled" ? liuyang.value.main?.humidity : null
    }
  ];

  const merged = {
    ts: Date.now(),
    location: { lat: LAT, lon: LON, name: "惠东双月湾" },
    windy: windy.status === "fulfilled" ? extractWindy(windy.value) : { error: windy.reason?.message },
    owm: owm.status === "fulfilled" ? owm.value : { error: owm.reason?.message },
    sun: sun.status === "fulfilled" ? sun.value : { error: sun.reason?.message },
    compare: compare
  };

  await cachePut(env, cacheKey, merged, 600); // 10 分钟缓存
  return json(merged);
}

async function handleForecast(env, url) {
  const type = url.searchParams.get("type") === "daily" ? "daily" : "hourly";
  const cacheKey = `forecast:${LAT}:${LON}:${type}`;
  const cached = await cacheGetFresh(env, cacheKey);
  if (cached) return json(cached);

  const owm = await fetchOWM(env, LAT, LON);
  const data = type === "daily"
    ? { ts: Date.now(), type, daily: (owm.daily || []).slice(0, 8) }
    : { ts: Date.now(), type, hourly: (owm.hourly || []).slice(0, 48) };

  const ttl = type === "daily" ? 3 * 3600 : 3600;
  await cachePut(env, cacheKey, data, ttl);
  return json(data);
}

async function handleAstro(env, url) {
  const date = url.searchParams.get("date") || "today";
  const cacheKey = `astro:${LAT}:${LON}:${date}`;
  const cached = await cacheGetFresh(env, cacheKey);
  if (cached) return json(cached);

  const sun = await fetchSun(LAT, LON, date);
  const data = { ts: Date.now(), date, sun };
  await cachePut(env, cacheKey, data, 24 * 3600);
  return json(data);
}

// === 工具 ===

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}

function extractWindy(w) {
  if (!w || !Array.isArray(w.ts) || w.ts.length === 0) return { error: "no data", atmError: w?.atmError, waveError: w?.waveError };
  const get = (k) => w[k];
  return {
    ts: w.ts.slice(0, 6),
    units: w.units || {},
    wind: (get("wind") || []).slice(0, 6),
    windGust: (get("windGust") || []).slice(0, 6),
    temp: (get("temp") || []).slice(0, 6),
    precip: (get("precip") || []).slice(0, 6),
    cloud: (get("cloud") || []).slice(0, 6),
    humidity: (get("rh") || get("humidity") || []).slice(0, 6),
    pressure: (get("pressure") || []).slice(0, 6),
    waveHeight: (get("waves") || get("waveHeight") || []).slice(0, 6),
    wavePeriod: (get("waves-period") || get("wavePeriod") || []).slice(0, 6),
    waveDirection: (get("waves-direction") || get("waveDirection") || []).slice(0, 6),
    windWaveHeight: (get("windWaveHeight") || []).slice(0, 6),
    swell1Height: (get("swell1Height") || []).slice(0, 6)
  };
}

// === Worker entry ===

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/now" && request.method === "GET") return await handleNow(env);
      if (path === "/api/forecast" && request.method === "GET") return await handleForecast(env, url);
      if (path === "/api/astro" && request.method === "GET") return await handleAstro(env, url);
      if (path === "/api/health") return json({ ok: true, ts: Date.now() });
    } catch (e) {
      return json({ error: e.message }, 500);
    }

    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
};
