const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

function b64urlToBytes(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function fetchJwks({ forceFresh = false } = {}) {
    const cache = caches.default;
    const cacheKey = new Request(JWKS_URL);
    if (!forceFresh) {
        const cached = await cache.match(cacheKey);
        if (cached) return { jwks: await cached.json(), cachePut: null };
    }
    const resp = await fetch(JWKS_URL, { cf: { cacheTtl: 3600 } });
    if (!resp.ok) throw new Error('Failed to fetch Google JWKS');
    const toCache = resp.clone();
    return { jwks: await resp.json(), cachePut: cache.put(cacheKey, toCache) };
}

async function getJwkByKid(kid, ctx) {
    let { jwks, cachePut } = await fetchJwks();
    if (cachePut) ctx.waitUntil(cachePut);
    let key = jwks.keys.find(k => k.kid === kid);
    if (!key) {
        // Key rotation happened since our cache was populated — bypass once before rejecting.
        const fresh = await fetchJwks({ forceFresh: true });
        if (fresh.cachePut) ctx.waitUntil(fresh.cachePut);
        key = fresh.jwks.keys.find(k => k.kid === kid);
    }
    if (!key) throw new Error('Unknown signing key');
    return key;
}

async function importJwk(jwk) {
    return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

// Throws on any validation failure. Returns { sub, email, name } on success.
export async function verifyGoogleIdToken(idToken, expectedAudience, ctx) {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
    if (header.alg !== 'RS256') throw new Error('Unexpected alg');

    const key = await importJwk(await getJwkByKid(header.kid, ctx));
    const valid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5', key, b64urlToBytes(sigB64),
        new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) throw new Error('Bad signature');
    if (!ISSUERS.has(payload.iss)) throw new Error('Bad issuer');
    if (payload.aud !== expectedAudience) throw new Error('Bad audience');
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) throw new Error('Token expired');
    if (payload.iat && payload.iat > now + 60) throw new Error('Token issued in the future');

    return { sub: payload.sub, email: payload.email, name: payload.name };
}
