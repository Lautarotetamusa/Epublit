import { createHmac, timingSafeEqual } from "crypto";

const MAX_AGE_SECONDS = 10 * 60;

export type WebhookSignatureInput = {
    secret: string;
    signature: string | null | undefined;
    requestId: string | null | undefined;
    dataId: string | null | undefined;
};

const parseHeader = (header: string) => {
    const values = new Map<string, string>();

    for (const part of header.split(",")) {
        const [key, value] = part.split("=").map((item) => item.trim());
        if (key && value !== undefined) values.set(key, value);
    }

    return values;
};

export function isWebhookSignatureValid({
    secret,
    signature,
    requestId,
    dataId
}: WebhookSignatureInput): boolean {
    if (!secret || !signature || !requestId || !dataId) return false;

    const values = parseHeader(signature);
    const ts = values.get("ts");
    const v1 = values.get("v1");
    if (!ts || !v1) return false;

    const timestamp = Number(ts);
    if (!Number.isFinite(timestamp)) return false;
    if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > MAX_AGE_SECONDS) return false;

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expected = createHmac("sha256", secret).update(manifest).digest("hex");

    const received = Buffer.from(v1, "hex");
    const expectedValue = Buffer.from(expected, "hex");

    return received.length === expectedValue.length && timingSafeEqual(received, expectedValue);
}

export function signWebhook(
    secret: string,
    dataId: string,
    requestId: string,
    ts = Math.floor(Date.now() / 1000)
): string {
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
    return `ts=${ts},v1=${v1}`;
}
