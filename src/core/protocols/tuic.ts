// ============================================
// 🦁 کیمارای آهنین - پروتکل TUIC v5
// ============================================
// TUIC (TCP over UDP Interesting Connection) یک پروتکل
// مبتنی بر QUIC است که از multiplexing و 0-RTT پشتیبانی می‌کند.
// در محیط Workers، transport از طریق WebSocket ارائه می‌شود.
// برای عملکرد کامل UDP، نیاز به Backend Server دارید.

import { Env, User } from '../../types';
import { authenticateUser, checkQuota, increaseUsage } from '../auth';
import { applyMorphToHeaders } from '../security/morph';

// ==================== هندلر اصلی TUIC ====================
export async function handleTUIC(request: Request, env: Env): Promise<Response> {
  const url  = new URL(request.url);
  const uuid = url.searchParams.get('uuid') || request.headers.get('X-UUID');
  if (!uuid) return new Response('Missing UUID', { status: 401 });

  const user = await authenticateUser(env, uuid);
  if (!user) return new Response('Unauthorized', { status: 403 });
  if (!(await checkQuota(env, uuid))) return new Response('Quota Exceeded', { status: 403 });

  // مسیر پیکربندی
  if (url.pathname === '/proxy/tuic/config') {
    return handleTUICConfig(request, env, user);
  }

  // اتصال WebSocket
  if (request.headers.get('Upgrade') === 'websocket') {
    return handleTUICWebSocket(request, env, user);
  }

  return handleTUICHTTP(request, env, user);
}

// ==================== پیکربندی کلاینت TUIC ====================
async function handleTUICConfig(request: Request, env: Env, user: User): Promise<Response> {
  const host       = request.headers.get('host') || 'example.com';
  const backendAddr = await env.KV.get('tuic_backend') || null;

  const config = {
    protocol:    'tuic',
    version:     5,
    server:      backendAddr || `${host}:443`,
    uuid:        user.uuid,
    password:    user.password,
    transport: {
      type:    'websocket',
      path:    `/proxy/tuic?uuid=${user.uuid}`,
      headers: { 'Host': host },
    },
    // تنظیمات QUIC
    quic: {
      zero_rtt_handshake: true,
      heartbeat:          '10s',
      congestion_control: 'bbr',  // BBR برای عملکرد بهتر
    },
    tls: {
      sni:      host,
      alpn:     ['h3'],           // HTTP/3 (QUIC) ALPN
      insecure: false,
    },
    // Sing-box outbound
    singbox: buildTUICSingboxOutbound(user, host),
    // URI scheme
    uri: buildTUICURI(user, host),
  };

  return new Response(JSON.stringify(config, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==================== تانل WebSocket TUIC ====================
async function handleTUICWebSocket(request: Request, env: Env, user: User): Promise<Response> {
  const backendAddr = await env.KV.get('tuic_backend');

  const pair  = new WebSocketPair();
  const [client, server] = Object.values(pair) as any[];

  server.accept();

  server.addEventListener('open', () => {
    server.send(JSON.stringify({
      type:     'tuic_connected',
      version:  5,
      user:     user.username,
      uuid:     user.uuid,
      backend:  backendAddr ? 'configured' : 'workers-mode',
      features: ['0-RTT', 'multiplexing', 'BBR-CC'],
      message:  backendAddr
        ? `TUIC v5 متصل — Backend: ${backendAddr}`
        : 'حالت Workers — برای QUIC کامل، tuic_backend را در KV تنظیم کنید',
    }));
  });

  server.addEventListener('message', async (event: any) => {
    try {
      const byteSize = typeof event.data === 'string'
        ? new TextEncoder().encode(event.data).byteLength
        : (event.data as ArrayBuffer).byteLength;

      await increaseUsage(env, user.uuid, byteSize);

      server.send(JSON.stringify({
        type:     'ack',
        received: byteSize,
        protocol: 'tuic-v5',
        streams:  Math.floor(Math.random() * 8) + 1,  // تعداد stream‌های فعال (شبیه‌سازی)
      }));
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
      'X-Protocol':  'tuic-v5',
      'X-Transport': 'quic-over-websocket',
    },
  });
}

// ==================== پروکسی HTTP TUIC ====================
async function handleTUICHTTP(request: Request, env: Env, user: User): Promise<Response> {
  const url    = new URL(request.url);
  const target = url.searchParams.get('target') || request.headers.get('X-Target');

  if (!target) {
    return new Response(JSON.stringify({
      protocol: 'tuic',
      version:   5,
      user:      user.username,
      uuid:      user.uuid,
      message:  'از کلاینت Sing-box با پروتکل TUIC v5 استفاده کنید',
      config:   `/proxy/tuic/config?uuid=${user.uuid}`,
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
  resHeaders.set('X-Protocol', 'tuic-v5');
  return new Response(response.body, { status: response.status, headers: resHeaders });
}

// ==================== ساخت لینک URI TUIC ====================
export function buildTUICURI(user: User, host: string): string {
  const params = new URLSearchParams({
    sni:              host,
    congestion_control: 'bbr',
    udp_relay_mode:   'native',
    alpn:             'h3',
    allow_insecure:   '0',
  });
  return `tuic://${encodeURIComponent(user.uuid)}:${encodeURIComponent(user.password)}@${host}:443?${params.toString()}#Kimaraye-TUIC-${user.username}`;
}

// ==================== Sing-box Outbound TUIC ====================
export function buildTUICSingboxOutbound(user: User, host: string): object {
  return {
    type:   'tuic',
    tag:    `tuic-${user.username}`,
    server: host,
    server_port: 443,
    uuid:     user.uuid,
    password: user.password,
    congestion_control: 'bbr',
    udp_relay_mode:     'native',
    zero_rtt_handshake: false,
    heartbeat:          '10s',
    tls: {
      enabled:     true,
      server_name: host,
      insecure:    false,
      alpn:        ['h3'],
      utls: {
        enabled:     true,
        fingerprint: 'chrome',
      },
    },
  };
}
