import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

export type CredentialsCipher = {
    encrypt: (plainText: string) => string;
    decrypt: (encrypted: string) => string;
};

// AES-256-GCM nativo: iv y tag viajan junto al ciphertext. La clave se deriva
// con SHA-256 para aceptar cualquier secreto de entorno sin exigir 32 bytes.
export function createCredentialsCipher(secret: string): CredentialsCipher {
    const key = createHash("sha256").update(secret).digest();

    const encrypt = (plainText: string): string => {
        const iv = randomBytes(12);
        const cipher = createCipheriv(ALGORITHM, key, iv);
        const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
        const tag = cipher.getAuthTag();

        return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
    };

    const decrypt = (encrypted: string): string => {
        const [version, ivB64, tagB64, ciphertextB64] = encrypted.split(":");
        if (version !== VERSION || !ivB64 || !tagB64 || !ciphertextB64) {
            throw new Error("Credencial cifrada inválida");
        }

        const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64url"));
        decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
        const plain = Buffer.concat([
            decipher.update(Buffer.from(ciphertextB64, "base64url")),
            decipher.final()
        ]);

        return plain.toString("utf8");
    };

    return { encrypt, decrypt };
}
