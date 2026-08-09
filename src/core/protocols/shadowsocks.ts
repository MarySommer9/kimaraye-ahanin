// ============================================
// 🦁 کیمارای آهنین - پروتکل Shadowsocks
// ============================================
// Shadowsocks از رمزنگاری متقارن (AES-256-GCM) برای
// محافظت از ترافیک استفاده می‌کند.

import { Env } from '../../types';
import { decrypt, encrypt } from '../../utils/crypto';
import { applyMorphToHeaders } from '../security/morph';

export async function handleShadowsocks(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const password = url.searchParams.get('password') || request.headers.get('X-Password');
    if (!password) return new Response('Missing Password', { status: 401 });

    // جستجوی کاربر در دیتابیس
    const user = await env.DB.prepare(
        'SELECT * FROM users WHERE password = ? AND is_active = 1 AND (expires_at > ? OR expires_at = 0) LIMIT 1'
    ).bind(password, Date.now()).first();
    if (!user) return new Response('Unauthorized', { status: 403 });

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
    if (targetUrl.protocol !== 'https:') {
        return new Response('Only HTTPS targets are allowed', { status: 400 });
    }

    // رمزگشایی body ورودی (اگر داده‌ای وجود داشته باشد)
    let bodyToSend: BodyInit | null = null;
    if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
        const encryptedBody = await request.arrayBuffer();
        if (encryptedBody.byteLength > 0) {
            try {
                // تلاش برای رمزگشایی — اگر داده رمزنگاری‌شده نیست، raw ارسال می‌شود
                const decryptedBody = await decrypt(new Uint8Array(encryptedBody), password);
                bodyToSend = decryptedBody;
            } catch {
                // اگر رمزگشایی شکست خورد، body خام را ارسال می‌کند
                bodyToSend = encryptedBody;
            }
        }
    }

    const proxyReq = new Request(targetUrl.toString(), {
        method: request.method,
        headers: applyMorphToHeaders(request.headers),
        body: bodyToSend,
    });

    try {
        const response = await fetch(proxyReq);
        const responseBody = await response.arrayBuffer();

        // رمزگذاری پاسخ
        const encryptedResponse = await encrypt(new Uint8Array(responseBody), password);

        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'application/octet-stream');
        responseHeaders.set('X-Shadowsocks', 'enabled');
        responseHeaders.set('X-Protocol', 'shadowsocks');

        return new Response(encryptedResponse, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: 'Proxy error', message: err.message }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
