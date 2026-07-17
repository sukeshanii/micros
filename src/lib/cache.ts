import { getCloudflareEnv } from './get-env';

var memjs: any = null;

async function getMemjs() {
  if (!memjs) {
    try { memjs = await import('memjs'); } catch {}
  }
  return memjs;
}

const MEMCACHED_HOST = process.env.MEMCACHED_HOST || 'localhost';
const MEMCACHED_PORT = process.env.MEMCACHED_PORT || '11211';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600');

let client: any = null;

async function getClient(): Promise<any> {
  if (!client) {
    const m = await getMemjs();
    if (m) {
      client = m.Client.create(`${MEMCACHED_HOST}:${MEMCACHED_PORT}`);
    }
  }
  return client;
}

function isKV(env: any): boolean {
  return env && env.CACHE && typeof env.CACHE.get === 'function';
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const env = await getCloudflareEnv();
  if (isKV(env)) {
    try {
      const val = await env.CACHE.get(key, 'json');
      return val as T | null;
    } catch {
      return null;
    }
  }

  try {
    const c = await getClient();
    if (!c) return null;
    const result = await c.get(key);
    if (result && result.value) {
      return JSON.parse(result.value.toString()) as T;
    }
    return null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: any): Promise<void> {
  const env = await getCloudflareEnv();
  if (isKV(env)) {
    try {
      await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: CACHE_TTL });
    } catch {}
    return;
  }

  try {
    const c = await getClient();
    if (!c) return;
    await c.set(key, JSON.stringify(value), { expires: CACHE_TTL });
  } catch {}
}

export async function cacheDel(key: string): Promise<void> {
  const env = await getCloudflareEnv();
  if (isKV(env)) {
    try {
      await env.CACHE.delete(key);
    } catch {}
    return;
  }

  try {
    const c = await getClient();
    if (!c) return;
    await c.delete(key);
  } catch {}
}

export function profileCacheKey(userId: number): string {
  return `profile:${userId}`;
}

export function userCacheKey(email: string): string {
  return `user:${email.toLowerCase().trim()}`;
}
