import { verifySession, readSessionCookie, sessionCookie } from '../../_lib/session.js';

export async function onRequestPost({ request, env }) {
    if ((request.headers.get('Content-Type') || '').split(';')[0] !== 'application/json') {
        return new Response('Bad content type', { status: 400 });
    }
    const payload = await verifySession(readSessionCookie(request), env.SESSION_SECRET);
    if (!payload) return new Response('Not signed in', { status: 401 });
    await env.DB.prepare('DELETE FROM users WHERE google_sub = ?').bind(payload.sub).run();
    return new Response(null, { status: 204, headers: { 'Set-Cookie': sessionCookie(null, { clear: true }) } });
}
