// ============================================
// 🦁 کیمارای آهنین - پروتکل Reality
// ============================================
// Reality یک لایه‌ی امنیتی پیشرفته است که از XTLS Reality استفاده می‌کند.
// در این پیاده‌سازی اولیه، از Web Crypto API برای تولید کلید ECDH
// و شبیه‌سازی فرآیند handshake استفاده می‌شود.

import { Env, User } from '../../types';
import { authenticateUser, checkQuota, increaseUsage } from '../auth';
import { applyMorphToHeaders, getFragmentConfig } from '../security/morph';
import { generateX25519KeyPair } from '../../utils/crypto';

// ==================== هندلر اصلی Reality ====================
export async function handleReality(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // مسیر تولید کلید برای ادمین
  if (path === '/proxy/reality/keygen') {
    return handleRealityKeyGen(request, env);
  }

  // مسیر اطلاعات پیکربندی
  if (path === '/proxy/reality/config') {
    return handleRealityConfig(request, env);
  }

  // مسیر اصلی پروکسی
  return handleRealityProxy(request, env);
}

// ==================== تولید کلید Reality ====================
/**
 * یک جفت کلید ECDH جدید تولید می‌کند و ذخیره می‌کند.
 * فقط برای ادمین قابل دسترسی است.
 */
async function handleRealityKeyGen(request: Request, env: Env): Promise<Response> {
  // بررسی توکن ادمین
  const adminToken = await env.KV.get('admin_token') || 'admin123';
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || token !== adminToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const keyPair = await generateX25519KeyPair();

    // ذخیره‌ی کلیدها در KV
    await env.KV.put('reality_public_key',  keyPair.publicKey,  { expirationTtl: 86400 * 365 });
    await env.KV.put('reality_private_key', keyPair.privateKey, { expirationTtl: 86400 * 365 });

    // شناسه‌ی کوتاه برای shortId
    const shortId = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    await env.KV.put('reality_short_id', shortId);

    return new Response(JSON.stringify({
      success:    true,
      publicKey:  keyPair.publicKey,
      shortId,
      message:    'کلید با موفقیت تولید شد. کلید خصوصی را امن نگه دارید.',
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      error:   'خطا در تولید کلید',
      message: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ==================== اطلاعات پیکربندی Reality ====================
/**
 * اطلاعات لازم برای پیکربندی کلاینت Reality را برمی‌گرداند.
 */
async function handleRealityConfig(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid') || request.headers.get('X-UUID');
  if (!uuid) return new Response('Missing UUID', { status: 401 });

  const user = await authenticateUser(env, uuid);
  if (!user) return new Response('Unauthorized', { status: 403 });
  if (!(await checkQuota(env, uuid))) return new Response('Quota Exceeded', { status: 403 });

  const host      = request.headers.get('host') || 'example.com';
  const publicKey = await env.KV.get('reality_public_key') || '';
  const shortId   = await env.KV.get('reality_short_id')   || '';

  // تنظیمات Reality برای کلاینت
  const config = {
    protocol: 'vless',
    uuid,
    address:  host,
    port:     443,
    network:  'tcp',
    security: 'reality',
    realitySettings: {
      serverName: 'www.microsoft.com', // SNI واقعی برای camouflage
      fingerprint: 'chrome',
      publicKey,
      shortId,
      spiderX: '/',
    },
    // لینک اتصال برای وارد کردن در کلاینت
    shareLink: `vless://${uuid}@${host}:443?security=reality&sni=www.microsoft.com&fp=chrome&pbk=${encodeURIComponent(publicKey)}&sid=${shortId}&type=tcp#Reality-${user.username}`,
  };

  return new Response(JSON.stringify(config, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==================== پروکسی Reality ====================
/**
 * درخواست‌های اتصال Reality را پردازش می‌کند.
 */
async function handleRealityProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid') || request.headers.get('X-UUID');
  if (!uuid) return new Response('Missing UUID', { status: 401 });

  const user = await authenticateUser(env, uuid);
  if (!user) return new Response('Unauthorized', { status: 403 });
  if (!(await checkQuota(env, uuid))) return new Response('Quota Exceeded', { status: 403 });

  // پشتیبانی از WebSocket
  if (request.headers.get('Upgrade') === 'websocket') {
    return handleRealityWebSocket(request, env, user);
  }

  // پروکسی HTTP
  return handleRealityHTTP(request, env, user);
}

// ==================== WebSocket Reality ====================
async function handleRealityWebSocket(request: Request, env: Env, user: User): Promise<Response> {
  const pair  = new WebSocketPair();
  const [client, server] = Object.values(pair);

  server.accept();

  server.addEventListener('open', () => {
    server.send(JSON.stringify({
      type:      'reality_connected',
      user:       user.username,
      protocol:  'reality',
      timestamp:  Date.now(),
    }));
  });

  server.addEventListener('message', async (event) => {
    try {
      const byteSize = typeof event.data === 'string'
        ? new TextEncoder().encode(event.data).byteLength
        : (event.data as ArrayBuffer).byteLength;

      await increaseUsage(env, user.uuid, byteSize);

      server.send(JSON.stringify({
        type:     'ack',
        received:  byteSize,
        fragment:  getFragmentConfig(),
      }));
    } catch (err: any) {
      server.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: {
      'Upgrade':    'websocket',
      'Connection': 'Upgrade',
      'X-Protocol': 'reality',
      'X-Fragment':  getFragmentConfig(),
    },
  });
}

// ==================== HTTP پروکسی Reality ====================
async function handleRealityHTTP(request: Request, env: Env, user: User): Promise<Response> {
  const url    = new URL(request.url);
  const target = url.searchParams.get('target')
    || request.headers.get('X-Target')
    || 'https://www.microsoft.com';

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response('Invalid target URL', { status: 400 });
  }

  if (targetUrl.protocol !== 'https:') {
    return new Response('Only HTTPS targets are allowed', { status: 400 });
  }

  const morphedHeaders = applyMorphToHeaders(request.headers);
  morphedHeaders.delete('X-UUID');

  const proxyReq = new Request(targetUrl.toString(), {
    method:  request.method,
    headers: morphedHeaders,
    body:    request.body,
  });

  try {
    const response = await fetch(proxyReq);

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      await increaseUsage(env, user.uuid, parseInt(contentLength, 10));
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Protocol', 'reality');

    return new Response(response.body, {
      status:  response.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Proxy error', message: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
