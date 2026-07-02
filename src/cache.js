// KV cache helper with TTL (in seconds).
// Returns parsed JSON or null on miss.

export async function cacheGet(env, key) {
  try {
    const raw = await env.CACHE_KV.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function cachePut(env, key, value, ttlSec) {
  const payload = JSON.stringify({ v: value, e: Date.now() + ttlSec * 1000 });
  await env.CACHE_KV.put(key, payload, { expirationTtl: ttlSec });
}

export async function cacheGetFresh(env, key) {
  const raw = await cacheGet(env, key);
  if (!raw) return null;
  if (raw.e && raw.e < Date.now()) return null; // expired
  return raw.v;
}
