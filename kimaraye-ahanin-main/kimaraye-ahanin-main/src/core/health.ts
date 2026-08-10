// ============================================
// 🦁 کیمارای آهنین - سیستم Health Check
// ============================================
// این ماژول وضعیت سلامت سرویس را بررسی می‌کند:
// - دیتابیس D1
// - KV Namespace
// - Worker runtime
// و در صورت بروز مشکل، هشدار به تلگرام ارسال می‌کند.

import { Env } from '../types';

// ==================== تایپ‌های وضعیت سلامت ====================
export interface HealthStatus {
  status:     'healthy' | 'degraded' | 'unhealthy';
  timestamp:  number;
  version:    string;
  checks: {
    database: CheckResult;
    kv:       CheckResult;
    runtime:  CheckResult;
  };
  summary: string;
}

export interface CheckResult {
  ok:       boolean;
  latencyMs: number;
  message:  string;
}

// ==================== نسخه سرویس ====================
const SERVICE_VERSION = '3.0.0';

// ==================== هندلر اصلی Health Check ====================
/**
 * وضعیت کامل سلامت سرویس را بررسی کرده و پاسخ JSON می‌دهد.
 */
export async function handleHealthCheck(request: Request, env: Env): Promise<Response> {
  const status = await runHealthChecks(env);

  const httpStatus =
    status.status === 'healthy'   ? 200 :
    status.status === 'degraded'  ? 200 :
    503;

  // ارسال هشدار تلگرام در صورت unhealthy
  if (status.status === 'unhealthy') {
    await sendTelegramAlert(env, status).catch(() => { /* silent */ });
  }

  return new Response(JSON.stringify(status, null, 2), {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache',
      'X-Health-Status': status.status,
    },
  });
}

// ==================== اجرای تمام چک‌ها ====================
export async function runHealthChecks(env: Env): Promise<HealthStatus> {
  const [dbCheck, kvCheck, rtCheck] = await Promise.all([
    checkDatabase(env),
    checkKV(env),
    checkRuntime(),
  ]);

  const allOk      = dbCheck.ok && kvCheck.ok && rtCheck.ok;
  const anyFailed  = !dbCheck.ok || !kvCheck.ok;

  const status: HealthStatus['status'] =
    allOk       ? 'healthy'   :
    anyFailed   ? 'unhealthy' :
    'degraded';

  const failedChecks = [
    !dbCheck.ok && 'Database',
    !kvCheck.ok && 'KV',
    !rtCheck.ok && 'Runtime',
  ].filter(Boolean);

  return {
    status,
    timestamp: Date.now(),
    version:   SERVICE_VERSION,
    checks: {
      database: dbCheck,
      kv:       kvCheck,
      runtime:  rtCheck,
    },
    summary: allOk
      ? `سرویس سالم است — تمام ${Object.keys({ dbCheck, kvCheck, rtCheck }).length} بررسی موفق بودند`
      : `مشکل در: ${failedChecks.join(', ')}`,
  };
}

// ==================== بررسی دیتابیس D1 ====================
async function checkDatabase(env: Env): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await env.DB.prepare('SELECT 1 AS ping').first();
    const latencyMs = Date.now() - start;

    if (!result) {
      return { ok: false, latencyMs, message: 'دیتابیس پاسخ نداد' };
    }

    // بررسی تعداد کاربران برای اطمینان از سلامت جدول
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first();
    const userCount = (countResult as any)?.count ?? 0;

    return {
      ok: true,
      latencyMs,
      message: `D1 سالم است — ${userCount} کاربر در دیتابیس`,
    };
  } catch (err: any) {
    return {
      ok:        false,
      latencyMs: Date.now() - start,
      message:   `خطای دیتابیس: ${err.message}`,
    };
  }
}

// ==================== بررسی KV Namespace ====================
async function checkKV(env: Env): Promise<CheckResult> {
  const start    = Date.now();
  const testKey  = `health_check_${Date.now()}`;
  const testVal  = `ping_${Math.random()}`;

  try {
    // نوشتن و خواندن یک مقدار تستی
    await env.KV.put(testKey, testVal, { expirationTtl: 60 });
    const readBack = await env.KV.get(testKey);
    const latencyMs = Date.now() - start;

    if (readBack !== testVal) {
      return { ok: false, latencyMs, message: 'KV داده را درست برنگرداند' };
    }

    await env.KV.delete(testKey);

    // ذخیره آخرین وضعیت سالم در KV
    await env.KV.put('health_last_ok', Date.now().toString(), { expirationTtl: 3600 });

    return {
      ok: true,
      latencyMs,
      message: `KV سالم است — تأخیر ${latencyMs}ms`,
    };
  } catch (err: any) {
    return {
      ok:        false,
      latencyMs: Date.now() - start,
      message:   `خطای KV: ${err.message}`,
    };
  }
}

// ==================== بررسی Runtime Worker ====================
function checkRuntime(): CheckResult {
  const start = Date.now();
  try {
    // بررسی Web Crypto API
    const testBytes = crypto.getRandomValues(new Uint8Array(16));
    if (testBytes.length !== 16) throw new Error('crypto.getRandomValues ناقص');

    // بررسی دسترسی به زمان
    const now = Date.now();
    if (!now || now < 0) throw new Error('Date.now خراب است');

    return {
      ok:        true,
      latencyMs: Date.now() - start,
      message:   `Runtime سالم — Web Crypto فعال، زمان ${new Date(now).toISOString()}`,
    };
  } catch (err: any) {
    return {
      ok:        false,
      latencyMs: Date.now() - start,
      message:   `خطای Runtime: ${err.message}`,
    };
  }
}

// ==================== ارسال هشدار تلگرام ====================
/**
 * در صورت بروز مشکل، یک پیام هشدار به ربات تلگرام ارسال می‌کند.
 * نیاز به تنظیم TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID در KV دارد.
 */
async function sendTelegramAlert(env: Env, status: HealthStatus): Promise<void> {
  const botToken = await env.KV.get('telegram_bot_token');
  const chatId   = await env.KV.get('telegram_chat_id');

  if (!botToken || !chatId) return; // تلگرام تنظیم نشده

  const failedChecks = Object.entries(status.checks)
    .filter(([, v]) => !v.ok)
    .map(([k, v]) => `• ❌ ${k}: ${v.message}`)
    .join('\n');

  const message = [
    `🚨 *کیمارای آهنین - هشدار سلامت*`,
    ``,
    `وضعیت: *${status.status.toUpperCase()}*`,
    `زمان: \`${new Date(status.timestamp).toLocaleString('fa-IR')}\``,
    ``,
    `مشکلات:`,
    failedChecks,
    ``,
    `خلاصه: ${status.summary}`,
  ].join('\n');

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    chatId,
      text:       message,
      parse_mode: 'Markdown',
    }),
  });
}

// ==================== هندلر Health Check برای ادمین ====================
/**
 * نسخه‌ی ادمین با جزئیات بیشتر (نیاز به توکن دارد).
 */
export async function handleAdminHealthCheck(request: Request, env: Env): Promise<Response> {
  const adminToken = await env.KV.get('admin_token') || 'admin123';
  const token      = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token || token !== adminToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const status = await runHealthChecks(env);

  // اطلاعات اضافی برای ادمین
  const [lastOk, userCount] = await Promise.all([
    env.KV.get('health_last_ok'),
    env.DB.prepare('SELECT COUNT(*) as count FROM users').first().then(r => (r as any)?.count ?? 0).catch(() => 0),
  ]);

  const adminStatus = {
    ...status,
    admin: {
      lastSuccessfulCheck: lastOk ? new Date(parseInt(lastOk)).toISOString() : null,
      totalUsers: userCount,
      telegramConfigured: !!(await env.KV.get('telegram_bot_token')),
    },
  };

  return new Response(JSON.stringify(adminStatus, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
