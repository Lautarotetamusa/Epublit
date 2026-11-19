import { createHash, randomBytes } from "crypto";

// Para links de un solo uso que viajan por mail: en la base queda sólo el
// hash, así una copia de la base no alcanza para usarlos.
export const generarTokenSecreto = (): string => randomBytes(32).toString("base64url");

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
