// ============================================
// 🦁 کیمارای آهنین - احراز هویت و مدیریت کاربران
// ============================================

import { Env, User } from '../types';

// ==================== احراز هویت کاربر ====================
export async function authenticateUser(env: Env, uuid: string): Promise<User | null> {
  // بررسی کش KV
  const cached = await env.KV.get(`user:${uuid}`, 'json');
  if (cached) return cached as User;

  // جستجو در دیتابیس
  const result = await env.DB.prepare(
    `SELECT * FROM users 
     WHERE uuid = ? 
     AND is_active = 1 
     AND (expires_at > ? OR expires_at = 0)`
  ).bind(uuid, Date.now()).first();

  if (!result) return null;

  const user = result as User;
  // ذخیره در کش به مدت ۵ دقیقه
  await env.KV.put(`user:${uuid}`, JSON.stringify(user), { expirationTtl: 300 });
  return user;
}

// ==================== ایجاد کاربر جدید ====================
export async function createUser(env: Env, data: Partial<User>): Promise<User> {
  const id = crypto.randomUUID();
  const uuid = data.uuid || crypto.randomUUID();
  const password = data.password || crypto.randomUUID().substring(0, 12);

  await env.DB.prepare(
    `INSERT INTO users (id, username, uuid, password, protocol, quota, expires_at, created_at, is_active, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    data.username || `user_${Date.now()}`,
    uuid,
    password,
    data.protocol || 'vless',
    data.quota || 10,
    data.expires_at || 0,
    Date.now(),
    1,
    data.remark || ''
  ).run();

  // حذف کش
  await env.KV.delete(`user:${uuid}`);
  return { id, uuid, password, ...data } as User;
}

// ==================== لیست کاربران ====================
export async function listUsers(env: Env, limit = 100, offset = 0): Promise<User[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM users 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  return result.results as User[];
}

// ==================== به‌روزرسانی کاربر ====================
export async function updateUser(env: Env, uuid: string, updates: Partial<User>): Promise<boolean> {
  const keys = Object.keys(updates);
  if (keys.length === 0) return false;

  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => updates[k as keyof User]);

  const query = `UPDATE users SET ${setClause} WHERE uuid = ?`;
  await env.DB.prepare(query).bind(...values, uuid).run();

  // پاک کردن کش
  await env.KV.delete(`user:${uuid}`);
  return true;
}

// ==================== حذف کاربر ====================
export async function deleteUser(env: Env, uuid: string): Promise<boolean> {
  await env.DB.prepare('DELETE FROM users WHERE uuid = ?').bind(uuid).run();
  await env.KV.delete(`user:${uuid}`);
  return true;
}

// ==================== بررسی سهمیه ====================
export async function checkQuota(env: Env, uuid: string): Promise<boolean> {
  const user = await authenticateUser(env, uuid);
  if (!user) return false;
  return user.used < user.quota;
}

// ==================== افزایش مصرف ====================
export async function increaseUsage(env: Env, uuid: string, bytes: number): Promise<void> {
  await env.DB.prepare(
    'UPDATE users SET used = used + ? WHERE uuid = ?'
  ).bind(bytes / (1024 * 1024 * 1024), uuid).run();
  await env.KV.delete(`user:${uuid}`);
}
