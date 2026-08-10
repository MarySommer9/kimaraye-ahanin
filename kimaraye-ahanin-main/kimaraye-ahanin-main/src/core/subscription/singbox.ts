// ============================================
// 🦁 کیمارای آهنین - خروجی Sing-box (کامل)
// ============================================
// پشتیبانی از: VLESS، Trojan، Shadowsocks، Reality، Hysteria2، TUIC
// با پشتیبانی ECH (Encrypted Client Hello)

import { Env } from '../../types';
import { authenticateUser } from '../auth';
import { getCurrentEchConfig } from '../ech';
import { buildHysteria2SingboxOutbound } from '../protocols/hysteria2';
import { buildTUICSingboxOutbound } from '../protocols/tuic';

export async function generateSingbox(request: Request, env: Env, uuid: string): Promise<Response> {
  const user = await authenticateUser(env, uuid);
  if (!user) return new Response('Unauthorized', { status: 403 });

  const host    = request.headers.get('host') || 'localhost';
  const echConf = await getCurrentEchConfig(env);

  // تنظیمات ECH اگر موجود باشد
  const echTLS = echConf
    ? { ech: { enabled: true, config: [echConf.raw] } }
    : {};

  const utlsBase = {
    enabled:     true,
    fingerprint: 'chrome',
  };

  const tlsBase = (sni: string, extra: object = {}) => ({
    enabled:     true,
    server_name: sni,
    insecure:    false,
    utls:        utlsBase,
    ...echTLS,
    ...extra,
  });

  const wsTransport = (path: string) => ({
    type:    'ws',
    path,
    headers: { 'Host': host },
    max_early_data:    2048,
    early_data_header_name: 'Sec-WebSocket-Protocol',
  });

  // ---------- outbounds ----------
  const outbounds: any[] = [];

  // ۱. VLESS + WebSocket + TLS
  outbounds.push({
    type:        'vless',
    tag:         `vless-ws-${user.username}`,
    server:      host,
    server_port: 443,
    uuid,
    flow:        '',
    tls:         tlsBase(host),
    transport:   wsTransport(`/proxy/vless?uuid=${uuid}&ed=2048`),
    packet_encoding: 'xudp',
  });

  // ۲. Trojan + WebSocket + TLS
  outbounds.push({
    type:        'trojan',
    tag:         `trojan-ws-${user.username}`,
    server:      host,
    server_port: 443,
    password:    user.password,
    tls:         tlsBase(host),
    transport:   wsTransport(`/proxy/trojan?uuid=${uuid}&ed=2048`),
  });

  // ۳. Shadowsocks
  outbounds.push({
    type:        'shadowsocks',
    tag:         `ss-${user.username}`,
    server:      host,
    server_port: 443,
    method:      'chacha20-ietf-poly1305',
    password:    user.password,
    plugin:      'v2ray-plugin',
    plugin_opts: `tls;host=${host};path=/proxy/shadowsocks?password=${encodeURIComponent(user.password)};ed=2048`,
  });

  // ۴. Reality (VLESS + Reality)
  const realityPubKey = await env.KV.get('reality_public_key') || '';
  const realityShortId = await env.KV.get('reality_short_id') || '';
  if (realityPubKey) {
    outbounds.push({
      type:        'vless',
      tag:         `reality-${user.username}`,
      server:      host,
      server_port: 443,
      uuid,
      flow:        'xtls-rprx-vision',
      tls: {
        enabled:     true,
        server_name: 'www.microsoft.com',
        insecure:    false,
        utls:        utlsBase,
        reality: {
          enabled:    true,
          public_key: realityPubKey,
          short_id:   realityShortId,
        },
      },
      transport: { type: 'tcp' },
    });
  }

  // ۵. Hysteria2 (اگر backend تنظیم شده باشد)
  const h2Backend = await env.KV.get('hysteria2_backend');
  const h2Host    = h2Backend ? h2Backend.split(':')[0] : host;
  outbounds.push(buildHysteria2SingboxOutbound(user, h2Host));

  // ۶. TUIC v5 (اگر backend تنظیم شده باشد)
  const tuicBackend = await env.KV.get('tuic_backend');
  const tuicHost    = tuicBackend ? tuicBackend.split(':')[0] : host;
  outbounds.push(buildTUICSingboxOutbound(user, tuicHost));

  // ---------- selector و urltest ----------
  const allTags = outbounds.map(o => o.tag);

  const config = {
    log:        { level: 'info', timestamp: true },
    dns: {
      servers: [
        { tag: 'cloudflare', address: 'https://1.1.1.1/dns-query', strategy: 'prefer_ipv4' },
        { tag: 'local',      address: 'local', detour: 'direct' },
      ],
      rules: [
        { outbound: ['any'],     server: 'local' },
        { geosite: ['category-ads-all'], action: 'reject' },
      ],
      final: 'cloudflare',
    },
    inbounds: [
      {
        type:           'tun',
        tag:            'tun-in',
        address:        ['172.19.0.1/30', 'fdfe:dcba:9876::1/126'],
        mtu:             9000,
        auto_route:      true,
        strict_route:    true,
        stack:           'system',
        sniff:           true,
        sniff_override_destination: false,
      },
      {
        type:          'mixed',
        tag:           'mixed-in',
        listen:        '127.0.0.1',
        listen_port:   2080,
        sniff:         true,
      },
    ],
    outbounds: [
      {
        type: 'selector',
        tag:  'proxy',
        outbounds: ['auto', ...allTags, 'direct'],
        default:   'auto',
      },
      {
        type:       'urltest',
        tag:        'auto',
        outbounds:  allTags,
        url:        'https://www.gstatic.com/generate_204',
        interval:   '3m',
        tolerance:  50,
      },
      ...outbounds,
      { type: 'direct',   tag: 'direct' },
      { type: 'block',    tag: 'block'  },
      { type: 'dns',      tag: 'dns-out' },
    ],
    route: {
      auto_detect_interface: true,
      final: 'proxy',
      rules: [
        { protocol: 'dns',                                  outbound: 'dns-out' },
        { type: 'logical', mode: 'or', rules: [
          { protocol: 'quic' }, { network: 'udp', port: 443 }
        ], outbound: 'block' },
        { geosite: ['category-ads-all'],                    outbound: 'block'  },
        { geosite: ['ir'], geoip: ['ir'],                   outbound: 'direct' },
        { geosite: ['private'], geoip: ['private'],         outbound: 'direct' },
      ],
    },
    experimental: {
      cache_file: {
        enabled: true,
        path:    'cache.db',
        store_fakeip: true,
      },
      clash_api: {
        external_controller: '127.0.0.1:9090',
        external_ui:         'ui',
        external_ui_download_url: 'https://github.com/MetaCubeX/metacubexd/archive/gh-pages.zip',
        external_ui_download_detour: 'direct',
        default_mode:         'rule',
      },
    },
  };

  return new Response(JSON.stringify(config, null, 2), {
    headers: {
      'Content-Type':        'application/json',
      'Content-Disposition': `attachment; filename="singbox-${user.username}.json"`,
    },
  });
}
