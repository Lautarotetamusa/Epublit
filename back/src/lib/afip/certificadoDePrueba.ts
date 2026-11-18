import { execFile } from "child_process";
import { dirname, join } from "path";
import { promisify } from "util";
import { getCSRPath, getKeyPath } from "./Afip";

const execFileAsync = promisify(execFile);

// Sólo para desarrollo y tests: firma el CSR de la cuenta con su propia clave.
// ARCA no lo reconoce, pero sí pasa las validaciones de la subida
// (X.509 legible, corresponde a la clave, no vencido).
export async function firmarCertificadoDePrueba(cuit: string, dias: number): Promise<string> {
    const destino = join(dirname(getKeyPath(cuit)), `cert-prueba-${dias}d.crt`);

    await execFileAsync("openssl", [
        "x509", "-req",
        "-in", getCSRPath(cuit),
        "-signkey", getKeyPath(cuit),
        "-days", String(dias),
        "-out", destino
    ]);

    return destino;
}
