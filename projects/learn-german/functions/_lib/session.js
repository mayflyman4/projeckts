const enc = new TextEncoder();
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days — bounds the
// "delete doesn't revoke other devices' sessions" exposure window (sessions are
// stateless: no D1 read on /api/me, so a deleted account's token still verifies
// until it expires on whatever other device holds it).

function b64urlEncode(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function hmacKey(secret) {
    return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSession(payload, secret) {
    const body = { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS };
    const payloadBytes = enc.encode(JSON.stringify(body));
    const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), payloadBytes);
    return `${b64urlEncode(payloadBytes)}.${b64urlEncode(new Uint8Array(sig))}`;
}

// Returns the payload object, or null if missing/malformed/tampered/expired.
export async function verifySession(token, secret) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    let payloadBytes, sigBytes;
    try {
        payloadBytes = b64urlDecode(parts[0]);
        sigBytes = b64urlDecode(parts[1]);
    } catch {
        return null;
    }

    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), sigBytes, payloadBytes);
    if (!ok) return null;

    let payload;
    try {
        payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    } catch {
        return null;
    }
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload; // { sub, email, name, exp }
}

export function sessionCookie(token, { clear = false } = {}) {
    return `__Host-session=${clear ? '' : token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_MAX_AGE_SECONDS}`;
}

export function readSessionCookie(request) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/(?:^|;\s*)__Host-session=([^;]+)/);
    return match ? match[1] : null;
}
