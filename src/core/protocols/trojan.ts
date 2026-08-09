// ============================================
// 🦁 کیمارای آهنین - پروتکل Trojan
// ============================================
// پروتکل Trojan از رمز عبور (password) برای احراز هویت
// استفاده می‌کند (برخلاف VLESS که از UUID بهره می‌برد).
// در پیاده‌سازی واقعی، Trojan رمز عبور را به‌صورت هش SHA-224
// در بالای یک لایه‌ی TLS ارسال می‌کند.

import { Env, User } from '../../types';
import { checkQuota, increaseUsage } from '../auth';
import { applyMorphToHeaders, getFragmentConfig } from '../security/morph';
import { sha256Hex } from '../../utils/crypto';

// ==================== هندلر اصلی Trojan ====================
export async function handleTrojan(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // احراز هویت: رمز عبور از query string یا هدر سفارشی
  const password = url.searchParams.get('password') || request.headers.get('X-Password');
  if (!password) {
    return new Response('Missing Password', { status: 401 });
  }

  // جستجوی کاربر در دیتابیس با رمز عبور
  const user = await authenticateTrojanUser(env, password);
  if (!user) {
    return new Response('Unauthorized', { status: 403 });
  }

  // بررسی فعال بودن حساب
  if (!user.is_active) {
    return new Response('Account Disabled', { status: 403 });
  }

  // بررسی انقضا
  if (user.expires_at !== 0 && user.expires_at < Date.now()) {
    return new Response('Account Expired', { status: 403 });
  }

  // بررسی سهمیه
  if (!(await checkQuota(env, user.uuid))) {
    return new Response('Quota Exceeded', { status: 403 });
  }

  // مسیریابی بر اساس نوع اتصال
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader === 'websocket') {
    return handleTrojanWebSocket(request, env, user);
  } else {
    return handleTrojanHTTP(request, env, user);
  }
}

// ==================== احراز هویت Trojan ====================
/**
 * کاربر را بر اساس رمز عبور از دیتابیس پیدا می‌کند.
 * پشتیبانی از رمز عبور ساده و هش SHA-256
 */
async function authenticateTrojanUser(env: Env, password: string): Promise<User | null> {
  // ابتدا با رمز عبور ساده جستجو می‌کند
  let result = await env.DB.prepare(
    `SELECT * FROM users
     WHERE password = ?
     AND is_active = 1
     AND (expires_at > ? OR expires_at = 0)
     LIMIT 1`
  ).bind(password, Date.now()).first();

  if (result) return result as User;

  // در صورت عدم تطابق، با هش SHA-256 امتحان می‌کند
  // (برخی کلاینت‌ها رمز عبور را هش می‌کنند)
  try {
    const hashedPassword = await sha256Hex(password);
    result = await env.DB.prepare(
      `SELECT * FROM users
       WHERE password = ?
       AND is_active = 1
       AND (expires_at > ? OR expires_at = 0)
       LIMIT 1`
    ).bind(hashedPassword, Date.now()).first();

    if (result) return result as User;
  } catch {
    // نادیده گرفتن خطای هش
  }

  return null;
}

// ==================== اتصال WebSocket Trojan ====================
async function handleTrojanWebSocket(request: Request, env: Env, user: User): Promise<Response> {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  server.accept();

  // پیام خوش‌آمدگویی با اطلاعات اتصال
  server.addEventListener('open', () => {
    server.send(JSON.stringify({
      type: 'trojan_connected',
      user: user.username,
      protocol: 'trojan',
      timestamp: Date.now(),
    }));
  });

  server.addEventListener('message', async (event) => {
    try {
      const data = event.data;
      // در Trojan واقعی، داده‌ها به سمت هدف پراکسی می‌شوند
      // اینجا برای آموزش، یک echo با اطلاعات ارسال می‌کنیم
      const payload = typeof data === 'string'
        ? data
        : `[binary:${(data as ArrayBuffer).byteLength}bytes]`;

      // ثبت مصرف (تخمینی)
      const byteSize = typeof data === 'string'
        ? new TextEncoder().encode(data).byteLength
        : (data as ArrayBuffer).byteLength;

      await increaseUsage(env, user.uuid, byteSize);

      server.send(JSON.stringify({
        type: 'echo',
        data: payload,
        fragment: getFragmentConfig(),
        morph: true,
      }));
    } catch (err: any) {
      server.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  server.addEventListener('close', () => {
    // پاکسازی منابع در صورت نیاز
  });

  server.addEventListener('error', (err) => {
    console.error('[Trojan WS Error]', err);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'X-Protocol': 'trojan',
      'X-Fragment': getFragmentConfig(),
    },
  });
}

// ==================== پروکسی HTTP Trojan ====================
async function handleTrojanHTTP(request: Request, env: Env, user: User): Promise<Response> {
  const url = new URL(request.url);
  const target = url.searchParams.get('target')
    || request.headers.get('X-Target')
    || 'https://httpbin.org/get';

  // اعتبارسنجی URL هدف
  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response('Invalid target URL', { status: 400 });
  }

  // فقط HTTPS مجاز است
  if (targetUrl.protocol !== 'https:') {
    return new Response('Only HTTPS targets are allowed', { status: 400 });
  }

  // اعمال morph روی هدرها
  const morphedHeaders = applyMorphToHeaders(request.headers);

  // افزودن هدرهای Trojan
  morphedHeaders.set('X-Trojan-User', user.username);
  morphedHeaders.delete('X-Password'); // حذف رمز عبور از هدرها

  const proxyReq = new Request(targetUrl.toString(), {
    method: request.method,
    headers: morphedHeaders,
    body: request.body,
  });

  try {
    const response = await fetch(proxyReq);

    // ثبت مصرف ترافیک
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      await increaseUsage(env, user.uuid, parseInt(contentLength, 10));
    }

    // برگرداندن پاسخ با هدرهای اضافه
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Protocol', 'trojan');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Proxy error', message: err.message }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
