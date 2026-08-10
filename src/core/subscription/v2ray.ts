// ============================================
// 🦁 کیمارای آهنین - خروجی V2Ray/Xray (کامل)
// ============================================
// تولید لینک‌های اشتراک برای V2Ray، Xray، و سایر کلاینت‌ها

import { Env } from '../../types';
import { authenticateUser } from '../auth';
import { buildHysteria2URI } from '../protocols/hysteria2';
import { buildTUICURI }      from '../protocols/tuic';

export async function generateV2Ray(request: Request, env: Env, uuid: string): Promise<Response> {
  const user = await authenticateUser(env, uuid);
  if (!user) return new Response('Unauthorized', { status: 403 });

  const host         = request.headers.get('host') || 'localhost';
  const name         = encodeURIComponent(`Kimaraye-${user.username}`);
  const realityPubKey  = await env.KV.get('reality_public_key')  || '';
  const realityShortId = await env.KV.get('reality_short_id')    || '';

  // ---------- VLESS ----------
  const vlessWS = `vless://${uuid}@${host}:443?` + new URLSearchParams({
    encryption: 'none',
    security:   'tls',
    sni:        host,
    fp:         'chrome',
    type:       'ws',
    host:       host,
    path:       `/proxy/vless?uuid=${uuid}&ed=2048`,
  }).toString() + `#${name}-VLESS`;

  // ---------- VLESS Reality ----------
  const vlessReality = realityPubKey
    ? `vless://${uuid}@${host}:443?` + new URLSearchParams({
        encryption: 'none',
        security:   'reality',
        sni:        'www.microsoft.com',
        fp:         'chrome',
        pbk:        realityPubKey,
        sid:        realityShortId,
        type:       'tcp',
        flow:       'xtls-rprx-vision',
      }).toString() + `#${name}-Reality`
    : null;

  // ---------- Trojan ----------
  const trojanWS = `trojan://${encodeURIComponent(user.password)}@${host}:443?` + new URLSearchParams({
    security:   'tls',
    sni:        host,
    fp:         'chrome',
    type:       'ws',
    host:       host,
    path:       `/proxy/trojan?uuid=${uuid}&ed=2048`,
  }).toString() + `#${name}-Trojan`;

  // ---------- Shadowsocks ----------
  const ssMethod   = 'chacha20-ietf-poly1305';
  const ssUserInfo = btoa(`${ssMethod}:${user.password}`).replace(/=+$/, '');
  const ssParams   = new URLSearchParams({
    plugin: `v2ray-plugin;tls;host=${host};path=/proxy/shadowsocks?password=${encodeURIComponent(user.password)}&ed=2048`,
  });
  const shadowsocks = `ss://${ssUserInfo}@${host}:443/?${ssParams.toString()}#${name}-SS`;

  // ---------- Hysteria2 ----------
  const hysteria2 = buildHysteria2URI(user, host);

  // ---------- TUIC ----------
  const tuic = buildTUICURI(user, host);

  // ---------- VMess (برای کلاینت‌های قدیمی‌تر) ----------
  const vmessConfig = {
    v:    '2',
    ps:   `Kimaraye-${user.username}`,
    add:  host,
    port: '443',
    id:   uuid,
    aid:  '0',
    scy:  'auto',
    net:  'ws',
    type: 'none',
    host: host,
    path: `/proxy/vless?uuid=${uuid}&ed=2048`,
    tls:  'tls',
    sni:  host,
    fp:   'chrome',
    alpn: '',
  };
  // در Workers از btoa استفاده می‌کنیم (Buffer وجود ندارد)
  const vmessLink = `vmess://${btoa(JSON.stringify(vmessConfig))}`;

  // ---------- خروجی متنی برای کپی ----------
  const links = [vlessWS, trojanWS, shadowsocks, hysteria2, tuic, vmessLink];
  if (vlessReality) links.splice(1, 0, vlessReality);

  const format = new URL(request.url).searchParams.get('output') || 'json';

  if (format === 'text') {
    // فرمت خام base64 برای کلاینت‌هایی مثل V2RayNG
    const raw = links.join('\n');
    return new Response(btoa(unescape(encodeURIComponent(raw))), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(JSON.stringify({
    username:    user.username,
    protocol:    user.protocol,
    generatedAt: new Date().toISOString(),
    links: {
      vless:      vlessWS,
      ...(vlessReality ? { reality: vlessReality } : {}),
      trojan:     trojanWS,
      shadowsocks,
      hysteria2,
      tuic,
      vmess:      vmessLink,
    },
    subscriptionUrls: {
      singbox: `https://${host}/sub?uuid=${uuid}&format=singbox`,
      clash:   `https://${host}/sub?uuid=${uuid}&format=clash`,
      v2ray:   `https://${host}/sub?uuid=${uuid}&format=v2ray&output=text`,
    },
    notes: {
      hysteria2: 'برای عملکرد کامل Hysteria2، کلید hysteria2_backend را در KV تنظیم کنید',
      tuic:      'برای عملکرد کامل TUIC، کلید tuic_backend را در KV تنظیم کنید',
      ech:       'برای فعال‌سازی ECH، ادمین باید /ech/keygen را اجرا کند',
    },
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
