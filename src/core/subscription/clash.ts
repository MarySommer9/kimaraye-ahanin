// ============================================
// 🦁 کیمارای آهنین - خروجی Clash
// ============================================

import { Env, User } from '../../types';
import { authenticateUser } from '../auth';

export async function generateClash(request: Request, env: Env, uuid: string): Promise<Response> {
  const user = await authenticateUser(env, uuid);
  if (!user) {
    return new Response('Unauthorized', { status: 403 });
  }

  const host = request.headers.get('host') || 'localhost';

  const yaml = `
proxies:
  - name: "🦁 Kimaaraye-${user.username}"
    type: vmess
    server: ${host}
    port: 443
    uuid: ${uuid}
    alterId: 0
    cipher: auto
    tls: true
    skip-cert-verify: false
    servername: ${host}
    network: ws
    ws-opts:
      path: /proxy/vless?uuid=${uuid}
      headers:
        X-UUID: ${uuid}
        User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

  - name: "🦁 Kimaaraye-Trojan-${user.username}"
    type: trojan
    server: ${host}
    port: 443
    password: ${user.password}
    tls: true
    skip-cert-verify: false
    servername: ${host}
    network: ws
    ws-opts:
      path: /proxy/trojan?uuid=${uuid}
      headers:
        X-UUID: ${uuid}

proxy-groups:
  - name: "🦁 Kimaaraye"
    type: select
    proxies:
      - "🦁 Kimaaraye-${user.username}"
      - "🦁 Kimaaraye-Trojan-${user.username}"

rules:
  - DOMAIN-SUFFIX,google.com,🦁 Kimaaraye
  - DOMAIN-SUFFIX,youtube.com,🦁 Kimaaraye
  - GEOIP,IR,DIRECT
  - MATCH,🦁 Kimaaraye
`;

  return new Response(yaml.trim(), {
    headers: { 'Content-Type': 'text/yaml' }
  });
}
