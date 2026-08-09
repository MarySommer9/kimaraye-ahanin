// ============================================
// 🦁 کیمارای آهنین - خروجی V2Ray
// ============================================

import { Env, User } from '../../types';
import { authenticateUser } from '../auth';

export async function generateV2Ray(request: Request, env: Env, uuid: string): Promise<Response> {
  const user = await authenticateUser(env, uuid);
  if (!user) {
    return new Response('Unauthorized', { status: 403 });
  }

  const host = request.headers.get('host') || 'localhost';

  const config = {
    v: '2',
    ps: `Kimaaraye-${user.username}`,
    add: host,
    port: '443',
    id: uuid,
    aid: '0',
    net: 'ws',
    type: 'none',
    host: host,
    path: `/proxy/vless?uuid=${uuid}`,
    tls: 'tls',
    sni: host,
    fp: 'chrome'
  };

  // ساخت لینک VMess (با encode base64)
  const vmessLink = `vmess://${Buffer.from(JSON.stringify(config)).toString('base64')}`;

  return new Response(JSON.stringify({
    vless: `vless://${uuid}@${host}:443?encryption=none&security=tls&sni=${host}&fp=chrome&type=ws&host=${host}&path=%2Fproxy%2Fvless%3Fuuid%3D${uuid}%26ed%3D2048#Kimaaraye-${user.username}`,
    trojan: `trojan://${user.password}@${host}:443?security=tls&sni=${host}&fp=chrome&type=ws&host=${host}&path=%2Fproxy%2Ftrojan%3Fuuid%3D${uuid}%26ed%3D2048#Kimaaraye-${user.username}`,
    vmess: vmessLink
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
