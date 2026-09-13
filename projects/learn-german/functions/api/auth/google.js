import { verifyGoogleIdToken } from '../../_lib/google.js';
import { createSession, sessionCookie } from '../../_lib/session.js';

export async function onRequestPost({ request, env, waitUntil }) {
    if ((request.headers.get('Content-Type') || '').split(';')[0] !== 'application/json') {
        return new Response('Bad content type', { status: 400 });
    }
    let body;
    try {
        body = await request.json();
    } catch {
        return new Response('Bad JSON', { status: 400 });
    }
    if (!body || typeof body.credential !== 'string' || body.credential.length > 4096) {
        return new Response('Missing credential', { status: 400 });
    }

    let claims;
    try {
        claims = await verifyGoogleIdToken(body.credential, env.GOOGLE_CLIENT_ID, { waitUntil });
    } catch {
        return new Response('Invalid token', { status: 401 });
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
        `INSERT INTO users (google_sub, email, name, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email, name = excluded.name, last_login_at = excluded.last_login_at`
    ).bind(claims.sub, claims.email, claims.name, now, now).run();

    const token = await createSession({ sub: claims.sub, email: claims.email, name: claims.name }, env.SESSION_SECRET);
    return new Response(JSON.stringify({ email: claims.email, name: claims.name }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-store',
            'Set-Cookie': sessionCookie(token),
        },
    });
}
