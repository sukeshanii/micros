import Memcached from 'memjs';

const MEMCACHED_HOST = process.env.MEMCACHED_HOST || 'localhost';
const MEMCACHED_PORT = process.env.MEMCACHED_PORT || '11211';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600'); // 1 hour default

let client: Memcached.Client | null = null;

function getClient(): Memcached.Client {
  if (!client) {
    client = Memcached.Client.create(`${MEMCACHED_HOST}:${MEMCACHED_PORT}`);
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const result = await getClient().get(key);
    if (result.value) {
      return JSON.parse(result.value.toString()) as T;
    }
    return null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: any): Promise<void> {
  try {
    await getClient().set(key, JSON.stringify(value), { expires: CACHE_TTL });
  } catch {
    // silent fail — cache is optional
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getClient().delete(key);
  } catch {
    // silent fail
  }
}

export function profileCacheKey(userId: number): string {
  return `profile:${userId}`;
}

export function userCacheKey(email: string): string {
  return `user:${email.toLowerCase().trim()}`;
}
