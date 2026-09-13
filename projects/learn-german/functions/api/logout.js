import { sessionCookie } from '../_lib/session.js';

export async function onRequestPost({ request }) {
    if ((request.headers.get('Content-Type') || '').split(';')[0] !== 'application/json') {
        return new Response('Bad content type', { status: 400 });
    }
    return new Response(null, { status: 204, headers: { 'Set-Cookie': sessionCookie(null, { clear: true }) } });
}
