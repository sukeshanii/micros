import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { createSession as dbCreateSession, deleteSession, getSessionUserId as dbGetSessionUserId, findUserByEmail as dbFindUserByEmail, createUser as dbCreateUser } from './db';

const SESSION_COOKIE = 'micro_session';
const SESSION_MAX_AGE = 365 * 24 * 60 * 60;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId: number, cookies: AstroCookies): Promise<string> {
  const token = generateToken();
  await dbCreateSession(token, userId);
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    maxAge: SESSION_MAX_AGE,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
  return token;
}

export async function destroySession(cookies: AstroCookies) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await deleteSession(token);
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function getSessionUserId(cookies: AstroCookies): Promise<number | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await dbGetSessionUserId(token);
  } catch {
    return null;
  }
}

export async function findUserByEmail(email: string): Promise<{ id: number; email: string } | null> {
  return dbFindUserByEmail(email);
}

export async function createUser(email: string): Promise<{ id: number; email: string }> {
  return dbCreateUser(email);
}
