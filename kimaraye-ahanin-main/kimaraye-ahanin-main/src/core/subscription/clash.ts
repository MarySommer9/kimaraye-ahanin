// ============================================
// 🦁 کیمارای آهنین - خروجی Clash Meta (کامل)
// ============================================
// پشتیبانی از: VLESS، Trojan، Shadowsocks، Hysteria2، TUIC

import { Env } from '../../types';
import { authenticateUser } from '../auth';

export async function generateClash(request: Request, env: Env, uuid: string): Promise<Response> {
  const user = await authenticateUser(env, uuid);
  if (!user) return new Response('Unauthorized', { status: 403 });

  const host        = request.headers.get('host') || 'localhost';
  const name        = user.username;
  const h2Backend   = await env.KV.get('hysteria2_backend') || `${host}:443`;
  const tuicBackend = await env.KV.get('tuic_backend')      || `${host}:443`;
  const [h2Host, h2Port]     = h2Backend.split(':');
  const [tuicHost, tuicPort] = tuicBackend.split(':');

  const yaml = `# 🦁 کیمارای آهنین — Clash Meta Config
# کاربر: ${name} | تولید: ${new Date().toISOString()}
# فقط برای Clash.Meta / Mihomo استفاده کنید

mixed-port: 7890
allow-lan: false
mode: rule
log-level: info
ipv6: false
external-controller: 127.0.0.1:9090

dns:
  enable: true
  listen: 0.0.0.0:53
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.0/15
  nameserver:
    - https://1.1.1.1/dns-query#proxy
    - https://8.8.8.8/dns-query#proxy
  fallback:
    - 8.8.8.8
    - 1.1.1.1
  fallback-filter:
    geoip: true
    geoip-code: IR

proxies:
  - name: "⚡ VLESS-${name}"
    type: vless
    server: ${host}
    port: 443
    uuid: ${uuid}
    tls: true
    skip-cert-verify: false
    servername: ${host}
    network: ws
    fingerprint: chrome
    ws-opts:
      path: "/proxy/vless?uuid=${uuid}&ed=2048"
      headers:
        Host: ${host}

  - name: "🛡️ Trojan-${name}"
    type: trojan
    server: ${host}
    port: 443
    password: ${user.password}
    tls: true
    skip-cert-verify: false
    servername: ${host}
    network: ws
    fingerprint: chrome
    ws-opts:
      path: "/proxy/trojan?uuid=${uuid}&ed=2048"
      headers:
        Host: ${host}

  - name: "🌑 SS-${name}"
    type: ss
    server: ${host}
    port: 443
    cipher: chacha20-ietf-poly1305
    password: ${user.password}
    plugin: v2ray-plugin
    plugin-opts:
      mode: websocket
      tls: true
      skip-cert-verify: false
      host: ${host}
      path: "/proxy/shadowsocks?password=${encodeURIComponent(user.password)}&ed=2048"

  - name: "💎 Reality-${name}"
    type: vless
    server: ${host}
    port: 443
    uuid: ${uuid}
    tls: true
    skip-cert-verify: false
    servername: www.microsoft.com
    network: tcp
    fingerprint: chrome
    reality-opts:
      public-key: "${await env.KV.get('reality_public_key') || ''}"
      short-id: "${await env.KV.get('reality_short_id') || ''}"

  - name: "⚡ Hysteria2-${name}"
    type: hysteria2
    server: ${h2Host || host}
    port: ${h2Port || 443}
    password: ${uuid}
    tls:
      sni: ${h2Host || host}
      skip-cert-verify: false
    obfs:
      type: salamander
      password: ${uuid.substring(0, 16)}
    up: "50 Mbps"
    down: "200 Mbps"

  - name: "🚀 TUIC-${name}"
    type: tuic
    server: ${tuicHost || host}
    port: ${tuicPort || 443}
    uuid: ${uuid}
    password: ${user.password}
    alpn:
      - h3
    skip-cert-verify: false
    congestion-controller: bbr
    udp-relay-mode: native
    sni: ${tuicHost || host}

proxy-groups:
  - name: "🦁 کیمارای آهنین"
    type: select
    proxies:
      - "🚀 خودکار"
      - "⚡ VLESS-${name}"
      - "🛡️ Trojan-${name}"
      - "🌑 SS-${name}"
      - "💎 Reality-${name}"
      - "⚡ Hysteria2-${name}"
      - "🚀 TUIC-${name}"
      - DIRECT

  - name: "🚀 خودکار"
    type: url-test
    url: https://www.gstatic.com/generate_204
    interval: 180
    tolerance: 50
    proxies:
      - "⚡ VLESS-${name}"
      - "🛡️ Trojan-${name}"
      - "⚡ Hysteria2-${name}"
      - "🚀 TUIC-${name}"

  - name: "🇮🇷 ایران"
    type: select
    proxies:
      - DIRECT
      - "🦁 کیمارای آهنین"

rules:
  - GEOSITE,category-ads-all,REJECT
  - GEOSITE,ir,🇮🇷 ایران
  - GEOIP,IR,🇮🇷 ایران,no-resolve
  - GEOSITE,private,DIRECT
  - GEOIP,private,DIRECT,no-resolve
  - GEOSITE,google,🦁 کیمارای آهنین
  - GEOSITE,youtube,🦁 کیمارای آهنین
  - GEOSITE,telegram,🦁 کیمارای آهنین
  - GEOSITE,twitter,🦁 کیمارای آهنین
  - GEOSITE,instagram,🦁 کیمارای آهنین
  - MATCH,🦁 کیمارای آهنین
`;

  return new Response(yaml.trim(), {
    headers: {
      'Content-Type':        'text/yaml; charset=utf-8',
      'Content-Disposition': `attachment; filename="clash-${user.username}.yaml"`,
    },
  });
}
