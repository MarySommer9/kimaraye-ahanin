// ============================================
// 🦁 کیمارای آهنین - خروجی Sing-box
// ============================================

import { Env, User } from '../../types';
import { authenticateUser } from '../auth';

export async function generateSingbox(request: Request, env: Env, uuid: string): Promise<Response> {
  const user = await authenticateUser(env, uuid);
  if (!user) {
    return new Response('Unauthorized', { status: 403 });
  }

  const host = request.headers.get('host') || 'localhost';

  const config = {
    outbounds: [
      {
        type: 'http',
        tag: `kimaraye-http-${user.username}`,
        server: host,
        server_port: 443,
        tls: {
          enabled: true,
          server_name: host,
          insecure: false,
          utls: {
            enabled: true,
            fingerprint: 'chrome'
          }
        },
        packet_encoding: 'packetaddr',
        headers: {
          'X-UUID': uuid,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      },
      {
        type: 'websocket',
        tag: `kimaraye-ws-${user.username}`,
        server: host,
        server_port: 443,
        tls: {
          enabled: true,
          server_name: host,
          insecure: false,
          utls: {
            enabled: true,
            fingerprint: 'chrome'
          }
        },
        path: `/proxy/vless?uuid=${uuid}`,
        headers: {
          'X-UUID': uuid,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    ]
  };

  return new Response(JSON.stringify(config, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
