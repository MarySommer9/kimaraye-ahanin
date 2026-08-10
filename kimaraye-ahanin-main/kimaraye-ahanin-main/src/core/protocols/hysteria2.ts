// ============================================
// 🦁 کیمارای آهنین - پروتکل Hysteria2
// ============================================
// Hysteria2 یک پروتکل مبتنی بر QUIC/UDP است که
// سرعت بالا و مقاومت در برابر DPI را ارائه می‌دهد.
// در محیط Cloudflare Workers، اتصال از طریق
// WebSocket یا HTTP/3 پروکسی می‌شود.
// برای پیاده‌سازی کامل نیاز به یک سرور Sing-box/Hysteria2
// در سمت Backend دارید.

import { Env, User } from '../../types';
import { authenticateUser, checkQuota, increaseUsage } from '../auth';
import { applyMorphToHeaders } from '../security/morph';

// ==================== هندلر اصلی Hysteria2 ====================
export async function handleHysteria2(request: Request, env: Env): Promise<Response> {
  const url  = new URL(request.url);
  const uuid = url.searchParams.get('uuid') || request.headers.get('X-UUID');
  if (!uuid) return new Response('Missing UUID', { status: 401 });

  const user = await authenticateUser(env, uuid);
  if (!user) return new Response('Unauthorized', { status: 403 });
  if (!(await checkQuota(env, uuid))) return new Response('Quota Exceeded', { status: 403 });

  const path = url.pathname;

  // مسیر پیکربندی کلاینت
  if (path === '/proxy/hysteria2/config') {
    return handleHysteria2Config(request, env, user);
  }

  // مسیر تانل از طریق WebSocket
  if (request.headers.get('Upgrade') === 'websocket') {
    return handleHysteria2WS(request, env, user);
  }

  return handleHysteria2HTTP(request, env, user);
}

// ==================== پیکربندی کلاینت Hysteria2 ====================
/**
 * تنظیمات Hysteria2 را برای Sing-box/Hysteria2 client برمی‌گرداند.
 * چون Workers نمی‌توانند مستقیماً UDP ارائه دهند،
 * از WebSocket-over-TLS به‌عنوان transport استفاده می‌شود.
 */
async function handleHysteria2Config(request: Request, env: Env, user: User): Promise<Response> {
  const host = request.headers.get('host') || 'example.com';

  // دریافت آدرس Backend Hysteria2 از KV (اگر تنظیم شده باشد)
  const backendAddr = await env.KV.get('hysteria2_backend') || null;

  const config = {
    protocol:    'hysteria2',
    server:      backendAddr || `${host}:443`,
    auth:        user.uuid,
    transport: {
      type:    'websocket',
      path:    `/proxy/hysteria2?uuid=${user.uuid}`,
      headers: { 'Host': host },
    },
    tls: {
      sni:      host,
      insecure: false,
    },
    bandwidth: {
      up:   '50 mbps',
      down: '200 mbps',
    },
    // Sing-box outbound format
    singbox: buildHysteria2SingboxOutbound(user, host),
    // URI scheme برای کلاینت‌های دیگر
    uri: buildHysteria2URI(user, host),
  };

  return new Response(JSON.stringify(config, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==================== تانل WebSocket ====================
async function handleHysteria2WS(request: Request, env: Env, user: User): Promise<Response> {
  // بررسی وجود Backend Hysteria2
  const backendAddr = await env.KV.get('hysteria2_backend');

  const pair  = new WebSocketPair();
  const [client, server] = Object.values(pair);

  server.accept();

  server.addEventListener('open', () => {
    server.send(JSON.stringify({
      type:     'hysteria2_connected',
      user:     user.username,
      backend:  backendAddr ? 'configured' : 'workers-mode',
      message:  backendAddr
        ? `متصل شد — Backend: ${backendAddr}`
        : 'حالت Workers — برای عملکرد کامل، hysteria2_backend را در KV تنظیم کنید',
    }));
  });

  server.addEventListener('message', async (event) => {
    try {
      const byteSize = typeof event.data === 'string'
        ? new TextEncoder().encode(event.data).byteLength
        : (event.data as ArrayBuffer).byteLength;

      await increaseUsage(env, user.uuid, byteSize);

      server.send(JSON.stringify({ type: 'ack', received: byteSize, protocol: 'hysteria2' }));
    } catch (err: any) {
      server.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  return new Response(null, {
    status:    101,
    webSocket: client,
    headers: {
      'Upgrade':     'websocket',
      'Connection':  'Upgrade',
      'X-Protocol':  'hysteria2',
      'X-Transport': 'websocket-over-tls',
    },
  });
}

// ==================== پروکسی HTTP ====================
async function handleHysteria2HTTP(request: Request, env: Env, user: User): Promise<Response> {
  const url    = new URL(request.url);
  const target = url.searchParams.get('target') || request.headers.get('X-Target');

  if (!target) {
    return new Response(JSON.stringify({
      protocol: 'hysteria2',
      user:      user.username,
      message:  'برای اتصال کامل از کلاینت Sing-box یا Hysteria2 استفاده کنید',
      config:   `/proxy/hysteria2/config?uuid=${user.uuid}`,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let targetUrl: URL;
  try { targetUrl = new URL(target); }
  catch { return new Response('Invalid target URL', { status: 400 }); }

  if (targetUrl.protocol !== 'https:') {
    return new Response('Only HTTPS targets are allowed', { status: 400 });
  }

  const headers = applyMorphToHeaders(request.headers);
  headers.delete('X-UUID');

  const response = await fetch(new Request(targetUrl.toString(), {
    method: request.method, headers, body: request.body,
  }));

  const contentLength = response.headers.get('content-length');
  if (contentLength) await increaseUsage(env, user.uuid, parseInt(contentLength, 10));

  const resHeaders = new Headers(response.headers);
  resHeaders.set('X-Protocol', 'hysteria2');
  return new Response(response.body, { status: response.status, headers: resHeaders });
}

// ==================== ساخت لینک URI Hysteria2 ====================
export function buildHysteria2URI(user: User, host: string): string {
  const params = new URLSearchParams({
    obfs:         'salamander',
    'obfs-password': user.uuid.substring(0, 16),
    sni:          host,
    insecure:     '0',
    pinSHA256:    '',
  });
  return `hysteria2://${encodeURIComponent(user.uuid)}@${host}:443?${params.toString()}#Kimaraye-H2-${user.username}`;
}

// ==================== Sing-box Outbound ====================
export function buildHysteria2SingboxOutbound(user: User, host: string): object {
  return {
    type:   'hysteria2',
    tag:    `hysteria2-${user.username}`,
    server: host,
    server_port: 443,
    up_mbps:   50,
    down_mbps: 200,
    password:  user.uuid,
    obfs: {
      type:     'salamander',
      password: user.uuid.substring(0, 16),
    },
    tls: {
      enabled:     true,
      server_name: host,
      insecure:    false,
      utls: {
        enabled:     true,
        fingerprint: 'chrome',
      },
    },
  };
}
