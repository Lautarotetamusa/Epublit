import { ContenidoError } from "./contenido.errors";
import type { BloqueWrite, ImagenReferenciaInput } from "./contenido.validator";

export type ContextoImagen = "portada" | "hero" | "bloque" | "galeria";

export type ReferenciaImagenConContexto = {
    campo: string;
    contexto: ContextoImagen;
    referencia: ImagenReferenciaInput;
};

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
    typeof valor === "object" && valor !== null && !Array.isArray(valor);

export const comoObjeto = (valor: unknown): Record<string, unknown> =>
    esObjeto(valor) ? valor : {};

export const comoReferenciaImagen = (valor: unknown): ImagenReferenciaInput | null => {
    if (!esObjeto(valor) || typeof valor.imagenId !== "number") return null;

    return {
        imagenId: valor.imagenId,
        textoAlternativo:
            typeof valor.textoAlternativo === "string" || valor.textoAlternativo === null
                ? valor.textoAlternativo
                : null,
        epigrafe:
            typeof valor.epigrafe === "string" || valor.epigrafe === null
                ? valor.epigrafe
                : null
    };
};

export const referenciaImagenEn = (valor: unknown, imagenId: number): boolean => {
    if (Array.isArray(valor)) return valor.some((item) => referenciaImagenEn(item, imagenId));
    if (!esObjeto(valor)) return false;
    if (valor.imagenId === imagenId) return true;

    return Object.values(valor).some((item) => referenciaImagenEn(item, imagenId));
};

export function idsDeImagenes(valor: unknown, ids: Set<number> = new Set()): Set<number> {
    if (Array.isArray(valor)) {
        valor.forEach((item) => idsDeImagenes(item, ids));
        return ids;
    }

    if (!esObjeto(valor)) return ids;
    if (typeof valor.imagenId === "number") ids.add(valor.imagenId);
    Object.values(valor).forEach((item) => idsDeImagenes(item, ids));

    return ids;
}

const referenciaEnBloque = (
    bloque: BloqueWrite,
    indice: number
): ReferenciaImagenConContexto | null => {
    if (bloque.tipo === "hero" && bloque.imagen) {
        return {
            campo: `bloques[${indice}].imagen`,
            contexto: "hero",
            referencia: bloque.imagen
        };
    }

    if (bloque.tipo === "imagen_texto" && bloque.imagen) {
        return {
            campo: `bloques[${indice}].imagen`,
            contexto: "bloque",
            referencia: bloque.imagen
        };
    }

    return null;
};

export function referenciasDeBloques(bloques: BloqueWrite[]): ReferenciaImagenConContexto[] {
    const referencias: ReferenciaImagenConContexto[] = [];

    bloques.forEach((bloque, indice) => {
        const referencia = referenciaEnBloque(bloque, indice);
        if (referencia) referencias.push(referencia);

        if (bloque.tipo === "galeria") {
            bloque.imagenes.forEach((imagen, imagenIndice) => {
                referencias.push({
                    campo: `bloques[${indice}].imagenes[${imagenIndice}]`,
                    contexto: "galeria",
                    referencia: imagen
                });
            });
        }
    });

    return referencias;
}

const DESTINO_PELIGROSO = /^(?:javascript|data):/i;
const DESTINO_VALIDO = /^(?:https?:\/\/|\/)/i;

const destinosDeEnlaces = (texto: string): string[] => {
    const destinos: string[] = [];
    let desde = 0;

    while (desde < texto.length) {
        const abre = texto.indexOf("[", desde);
        if (abre === -1) break;

        const cierra = texto.indexOf("](", abre + 1);
        if (cierra === -1) break;

        const fin = texto.indexOf(")", cierra + 2);
        if (fin === -1) break;

        destinos.push(texto.slice(cierra + 2, fin));
        desde = fin + 1;
    }

    return destinos;
};

const errorTexto = (campo: string, mensaje: string): ContenidoError =>
    new ContenidoError(400, "texto_invalido", "El texto contiene contenido no permitido", [
        { campo, codigo: "texto_invalido", mensaje }
    ]);

export function assertDestinoSeguro(campo: string, destino: string): void {
    if (DESTINO_PELIGROSO.test(destino.trim()) || !DESTINO_VALIDO.test(destino.trim())) {
        throw new ContenidoError(400, "texto_invalido", "El destino del enlace no es válido", [
            {
                campo,
                codigo: "texto_invalido",
                mensaje: "El destino debe empezar con http(s):// o /"
            }
        ]);
    }
}

export function assertTextoEnriquecido(campo: string, valor: string): void {
    if (valor.includes("<") || valor.includes(">")) {
        throw errorTexto(campo, "No se acepta HTML en el texto");
    }

    destinosDeEnlaces(valor).forEach((destino) => assertDestinoSeguro(campo, destino));
}

// Recorre los campos de texto libre con formato simple y los destinos que van
// a la landing. Los títulos y datos cortos no se interpretan como enlaces.
export function assertBloquesSeguros(bloques: BloqueWrite[]): void {
    bloques.forEach((bloque, indice) => {
        if (bloque.tipo === "texto") {
            assertTextoEnriquecido(`bloques[${indice}].contenido`, bloque.contenido);
        }

        if (bloque.tipo === "imagen_texto") {
            assertTextoEnriquecido(`bloques[${indice}].texto`, bloque.texto);
        }

        if (bloque.tipo === "enlaces") {
            bloque.enlaces.forEach((enlace, enlaceIndice) => {
                assertDestinoSeguro(`bloques[${indice}].enlaces[${enlaceIndice}].destino`, enlace.destino);
            });
        }
    });
}
