import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type OAuthStatePayload = {
    userId: number;
    nonce: string;
    exp: number;
};

const encode = (value: string): string => Buffer.from(value, "utf8").toString("base64url");
const decode = (value: string): string => Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string, secret: string): string =>
    createHmac("sha256", secret).update(payload).digest("base64url");

export function createOAuthState(userId: number, secret: string, ttlSeconds = 600): string {
    const payload: OAuthStatePayload = {
        userId,
        nonce: randomBytes(16).toString("base64url"),
        exp: Math.floor(Date.now() / 1000) + ttlSeconds
    };

    const encoded = encode(JSON.stringify(payload));
    return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyOAuthState(state: string, secret: string): OAuthStatePayload | null {
    const [encoded, signature] = state.split(".");
    if (!encoded || !signature) return null;

    const expected = sign(encoded, secret);
    const received = Buffer.from(signature);
    const esperado = Buffer.from(expected);

    if (received.length !== esperado.length || !timingSafeEqual(received, esperado)) return null;

    try {
        const payload = JSON.parse(decode(encoded)) as OAuthStatePayload;
        if (!Number.isInteger(payload.userId) || !Number.isInteger(payload.exp)) return null;
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;

        return payload;
    } catch {
        return null;
    }
}
