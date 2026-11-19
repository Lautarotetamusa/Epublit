import { randomBytes } from "crypto";

// Las cuentas nuevas no eligen usuario: el back necesita uno igual (la
// columna es obligatoria y única). Sin `@` para que nunca se confunda con un
// email al ingresar, y bien por debajo de los 25 caracteres de la columna.
export const generarUsernameInterno = (): string => `u_${randomBytes(8).toString("hex")}`;
