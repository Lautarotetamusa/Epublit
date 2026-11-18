import { asegurarCSR } from "../src/lib/afip/Afip";
import { firmarCertificadoDePrueba } from "../src/lib/afip/certificadoDePrueba";
import { SeedUser } from "./users.seeder";

const DIAS_VIGENTE = 730;
// Menos que el aviso de 30 días del perfil: para ver el estado "por vencer".
const DIAS_POR_VENCER = 10;

export type CertificadosDePrueba = { username: string; vigente: string; porVencer: string };

// Los usuarios del seed no pasan por el alta: se les genera clave y CSR, y
// certificados firmados con esa clave para probar la subida desde el perfil
// sin pasar por ARCA. No se suben: la cuenta queda sin certificado.
export async function seedCertificados(users: SeedUser[]): Promise<CertificadosDePrueba[]> {
    const certificados: CertificadosDePrueba[] = [];

    for (const user of users) {
        await asegurarCSR(user);
        certificados.push({
            username: user.username,
            vigente: await firmarCertificadoDePrueba(user.cuit, DIAS_VIGENTE),
            porVencer: await firmarCertificadoDePrueba(user.cuit, DIAS_POR_VENCER)
        });
    }

    return certificados;
}
