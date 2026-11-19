import { describe, expect, test } from 'vitest';
import fs from "fs";
import { join } from "path";
import { createEmailService } from '../src/lib/email';
import type { EnvioTemplate } from '../src/lib/email';

const TEMPLATES_DIR = join(__dirname, "../emails/templates");

// Variables Mustache del template (`{{nombre}}`, `{{{nombre}}}`), sin las
// internas de Postmark como `@content`.
const variablesDe = (alias: string): string[] => {
    const contenido = ["content.html", "content.txt"]
        .map((archivo) => fs.readFileSync(join(TEMPLATES_DIR, alias, archivo), "utf8"))
        .join("\n");
    const meta = JSON.parse(fs.readFileSync(join(TEMPLATES_DIR, alias, "meta.json"), "utf8")) as { Subject: string };
    const encontradas = [...`${contenido}\n${meta.Subject}`.matchAll(/\{\{\{?\s*([\w.]+)\s*\}?\}\}/g)].map((m) => m[1]);

    return [...new Set(encontradas)].sort();
};

const capturarEnvio = async (enviar: (service: ReturnType<typeof createEmailService>) => Promise<void>) => {
    const enviados: EnvioTemplate[] = [];
    const service = createEmailService({
        transporte: async (envio) => {
            enviados.push(envio);
        },
        panelUrl: "https://panel.epublit.test"
    });
    await enviar(service);
    return enviados[0];
};

describe('Templates de Postmark', () => {
    test('la bienvenida manda todas las variables que usa su template', async () => {
        const envio = await capturarEnvio((service) =>
            service.enviarBienvenida({ para: "a@b.com", nombre: "editorial", cuit: "20300000013", csr: Buffer.from("csr") })
        );

        expect(envio.alias).toBe("bienvenida");
        for (const variable of variablesDe("bienvenida")) {
            expect(envio.modelo, `falta "${variable}" en el modelo`).toHaveProperty(variable);
        }
    });

    test('los links apuntan al panel configurado', async () => {
        const envio = await capturarEnvio((service) =>
            service.enviarBienvenida({ para: "a@b.com", nombre: "editorial", cuit: "20300000013", csr: Buffer.from("csr") })
        );

        expect(envio.modelo.url_guia_certificado).toBe("https://panel.epublit.test/ayuda/certificado-arca");
        expect(envio.modelo.url_perfil).toBe("https://panel.epublit.test/perfil");
    });

    test('la confirmación de email manda todas las variables de su template y el link al panel', async () => {
        const envio = await capturarEnvio((service) =>
            service.enviarConfirmacionEmail({ para: "a@b.com", nombre: "Ediciones del Sur S.R.L.", token: "abc_123-x" })
        );

        expect(envio.alias).toBe("confirmar-email");
        expect(envio.para).toBe("a@b.com");
        for (const variable of variablesDe("confirmar-email")) {
            expect(envio.modelo, `falta "${variable}" en el modelo`).toHaveProperty(variable);
        }
        expect(envio.modelo.nombre).toBe("Ediciones del Sur S.R.L.");
        expect(envio.modelo.url_confirmar).toBe("https://panel.epublit.test/verificar-email?token=abc_123-x");
    });

    test('el restablecimiento de contraseña manda todas las variables de su template y el link al panel', async () => {
        const envio = await capturarEnvio((service) =>
            service.enviarRestablecimientoContrasena({ para: "a@b.com", cuenta: "Librería Sur S.A. (usuario libreria_sur)", token: "abc_123-x" })
        );

        expect(envio.alias).toBe("restablecer-contrasena");
        for (const variable of variablesDe("restablecer-contrasena")) {
            expect(envio.modelo, `falta "${variable}" en el modelo`).toHaveProperty(variable);
        }
        expect(envio.modelo.cuenta).toBe("Librería Sur S.A. (usuario libreria_sur)");
        expect(envio.modelo.url_restablecer).toBe("https://panel.epublit.test/restablecer-contrasena?token=abc_123-x");
    });
});
