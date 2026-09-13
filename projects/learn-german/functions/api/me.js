import { verifySession, readSessionCookie } from '../_lib/session.js';

export async function onRequestGet({ request, env }) {
    const payload = await verifySession(readSessionCookie(request), env.SESSION_SECRET);
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
    if (!payload) return new Response(JSON.stringify({ error: 'not signed in' }), { status: 401, headers });
    return new Response(JSON.stringify({ email: payload.email, name: payload.name }), { status: 200, headers });
}
