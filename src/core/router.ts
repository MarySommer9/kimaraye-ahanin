// ============================================
// 🦁 کیمارای آهنین - مسیریاب مرکزی (Router)
// ============================================
// این ماژول مسیریابی درخواست‌ها را به handler مناسب انجام می‌دهد.
// از یک ساختار Route-based استفاده می‌شود.

import { Env } from '../types';
import { handleVless }       from './protocols/vless';
import { handleTrojan }      from './protocols/trojan';
import { handleShadowsocks } from './protocols/shadowsocks';
import { handleReality }     from './protocols/reality';
import { adminAPI }          from './admin-panel';
import { generateSingbox, generateClash, generateV2Ray } from './subscription';
import { authenticateUser }  from './auth';
import { serveDecoy }        from './security/decoy';

// ==================== تایپ‌های مسیریابی ====================
type Handler = (request: Request, env: Env) => Promise<Response>;

interface Route {
  method:  string | string[];
  pattern: string | RegExp;
  handler: Handler;
}

// ==================== مسیرهای تعریف‌شده ====================
const routes: Route[] = [
  // --- پروتکل‌ها ---
  { method: ['GET', 'POST', 'PUT'], pattern: '/proxy/vless',       handler: handleVless },
  { method: ['GET', 'POST', 'PUT'], pattern: '/proxy/trojan',      handler: handleTrojan },
  { method: ['GET', 'POST', 'PUT'], pattern: '/proxy/shadowsocks', handler: handleShadowsocks },
  { method: ['GET', 'POST', 'PUT'], pattern: /^\/proxy\/reality/,  handler: handleReality },

  // --- ساب‌اسکریپشن ---
  { method: 'GET', pattern: '/sub', handler: handleSubscription },

  // --- پنل مدیریت ---
  { method: ['GET', 'POST', 'PUT', 'DELETE'], pattern: /^\/admin/, handler: adminAPI },
];

// ==================== مسیریاب اصلی ====================
/**
 * درخواست ورودی را به handler مناسب هدایت می‌کند.
 * اگر هیچ مسیری تطابق نداشت، به لایه‌ی Decoy می‌رود.
 *
 * @param request  درخواست HTTP ورودی
 * @param env      محیط Cloudflare Workers
 */
export async function router(request: Request, env: Env): Promise<Response> {
  const url    = new URL(request.url);
  const path   = url.pathname;
  const method = request.method.toUpperCase();

  // اضافه کردن هدرهای امنیتی به همه‌ی پاسخ‌ها
  try {
    for (const route of routes) {
      if (!matchMethod(method, route.method)) continue;
      if (!matchPattern(path, route.pattern)) continue;

      // مسیر پیدا شد - اجرای handler
      const response = await route.handler(request, env);
      return addSecurityHeaders(response);
    }

    // هیچ مسیری تطابق نداشت - لایه‌ی Decoy
    return addSecurityHeaders(await serveDecoy(request));

  } catch (err: any) {
    console.error('[Router Error]', err);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: err.message }),
      {
        status:  500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ==================== تطابق متد HTTP ====================
function matchMethod(method: string, routeMethod: string | string[]): boolean {
  if (Array.isArray(routeMethod)) {
    return routeMethod.includes(method);
  }
  return routeMethod === '*' || routeMethod === method;
}

// ==================== تطابق الگوی مسیر ====================
function matchPattern(path: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return path === pattern;
  }
  return pattern.test(path);
}

// ==================== هندلر ساب‌اسکریپشن ====================
async function handleSubscription(request: Request, env: Env): Promise<Response> {
  const url    = new URL(request.url);
  const uuid   = url.searchParams.get('uuid');
  const format = url.searchParams.get('format') || 'text';

  if (!uuid) return new Response('Missing UUID', { status: 401 });

  const user = await authenticateUser(env, uuid);
  if (!user) return new Response('Unauthorized', { status: 403 });

  switch (format) {
    case 'singbox': return generateSingbox(request, env, uuid);
    case 'clash':   return generateClash(request, env, uuid);
    case 'v2ray':   return generateV2Ray(request, env, uuid);
    default: {
      const host        = request.headers.get('host') || 'localhost';
      const vlessLink   = buildVlessLink(uuid, host);
      const trojanLink  = buildTrojanLink(user.password, host, uuid);
      return new Response(`VLESS: ${vlessLink}\nTrojan: ${trojanLink}`, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }
}

// ==================== سازنده‌های لینک ====================
function buildVlessLink(uuid: string, host: string): string {
  const path = encodeURIComponent(`/proxy/vless?uuid=${uuid}&ed=2048`);
  return `vless://${uuid}@${host}:443?encryption=none&security=tls&sni=${host}&fp=randomized&type=ws&host=${host}&path=${path}#Kimaraye-VLESS`;
}

function buildTrojanLink(password: string, host: string, uuid: string): string {
  const path = encodeURIComponent(`/proxy/trojan?uuid=${uuid}&ed=2048`);
  return `trojan://${password}@${host}:443?security=tls&sni=${host}&fp=randomized&type=ws&host=${host}&path=${path}#Kimaraye-Trojan`;
}

// ==================== هدرهای امنیتی ====================
function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options',        'DENY');
  headers.set('Referrer-Policy',        'no-referrer');
  // نگه داشتن Upgrade برای WebSocket
  if (response.status !== 101) {
    headers.set('X-XSS-Protection', '1; mode=block');
  }
  return new Response(response.body, {
    status:  response.status,
    headers,
    // @ts-ignore — webSocket موجود است روی Cloudflare Workers
    webSocket: (response as any).webSocket,
  });
}
