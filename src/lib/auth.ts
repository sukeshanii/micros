import * as db from './db';

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(userId: number, cookies: any): Promise<string> {
  const token = generateToken();
  await db.createSession(token, userId);
  cookies.set('micro_session', token, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
  return token;
}

export async function destroySession(cookies: any) {
  const token = cookies.get('micro_session')?.value;
  if (token) {
    await db.deleteSession(token);
  }
  cookies.delete('micro_session', { path: '/' });
}

export async function getSessionUserId(cookies: any): Promise<number | null> {
  const token = cookies.get('micro_session')?.value;
  if (!token) return null;
  try {
    return await db.getSessionUserId(token);
  } catch {
    return null;
  }
}

export async function findUserByEmail(email: string): Promise<{ id: number; email: string } | null> {
  return db.findUserByEmail(email);
}

export async function createUser(email: string): Promise<{ id: number; email: string }> {
  return db.createUser(email);
}
