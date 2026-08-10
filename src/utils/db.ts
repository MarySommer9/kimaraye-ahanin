// ============================================
// 🦁 کیمارای آهنین - توابع کمکی دیتابیس
// ============================================

import { Env, User } from '../types';

// ==================== دریافت کاربر بر اساس UUID ====================
export async function getUserByUUID(env: Env, uuid: string): Promise<User | null> {
  const cached = await env.KV.get(`user:${uuid}`, 'json');
  if (cached) return cached as User;

  const result = await env.DB.prepare(
    'SELECT * FROM users WHERE uuid = ? AND is_active = 1'
  ).bind(uuid).first();
  
  if (!result) return null;
  
  const user = result as unknown as User;
  await env.KV.put(`user:${uuid}`, JSON.stringify(user), { expirationTtl: 300 });
  return user;
}

// ==================== دریافت تنظیمات ====================
export async function getConfig(env: Env, key: string): Promise<string | null> {
  const result = await env.DB.prepare(
    'SELECT value FROM config WHERE key = ?'
  ).bind(key).first();
  return result ? (result as any).value : null;
}

// ==================== ذخیره تنظیمات ====================
export async function setConfig(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)'
  ).bind(key, value).run();
}
