// Sunrise-Sunset.org - free, no key
// Docs: https://sunrise-sunset.org/api
// Returns sunrise/sunset/twilight + moon data (via date math on our side).

const SUN_URL = "https://api.sunrise-sunset.org/json";

export async function fetchSun(lat, lon, dateISO) {
  const url = new URL(SUN_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lon));
  url.searchParams.set("date", dateISO || "today");
  url.searchParams.set("formatted", "0"); // ISO timestamps

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Sun ${res.status}`);
  const data = await res.json();
  if (data.status !== "OK") throw new Error(`Sun status: ${data.status}`);
  return data.results;
}
