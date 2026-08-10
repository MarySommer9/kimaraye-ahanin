import { Env } from '../../types';
import { authenticateUser, checkQuota, increaseUsage } from '../auth';
import { applyMorphToHeaders, getFragmentConfig } from '../security/morph';

export async function handleVless(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const uuid = url.searchParams.get('uuid') || request.headers.get('X-UUID');
    if (!uuid) return new Response('Missing UUID', { status: 401 });

    const user = await authenticateUser(env, uuid);
    if (!user) return new Response('Unauthorized', { status: 403 });
    if (!await checkQuota(env, uuid)) return new Response('Quota exceeded', { status: 403 });

    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader === 'websocket') {
        return handleVlessWebSocket(request, env, user);
    } else {
        return handleVlessHTTP(request, env, user);
    }
}

async function handleVlessWebSocket(request: Request, env: Env, user: any): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    server.addEventListener('message', async (event) => {
        const data = event.data;
        try {
            const response = await fetch('https://httpbin.org/get', {
                headers: applyMorphToHeaders(new Headers(request.headers))
            });
            const body = await response.arrayBuffer();
            server.send(body);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            server.send(JSON.stringify({ error: errorMessage }));
        }
    });

    return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
            'Upgrade': 'websocket',
            'Connection': 'Upgrade',
            'X-Fragment': getFragmentConfig().toString()
        }
    });
}

async function handleVlessHTTP(request: Request, env: Env, user: any): Promise<Response> {
    const target = request.headers.get('X-Target') || request.url;
    const morphedHeaders = applyMorphToHeaders(request.headers);
    const proxyReq = new Request(target, {
        method: request.method,
        headers: morphedHeaders,
        body: request.body
    });
    const response = await fetch(proxyReq);
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
        await increaseUsage(env, user.uuid, parseInt(contentLength));
    }

    return response;
}
