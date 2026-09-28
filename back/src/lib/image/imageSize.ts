// Lector mínimo de dimensiones PNG/JPEG (los dos únicos formatos que
// `persona.foto` acepta, ver specs/004-persona-foto-bio): evita traer una
// dependencia nueva sólo para leer un header de imagen.
export type ImageSize = { width: number; height: number };

export function getImageSize(buffer: Buffer, mimetype: string): ImageSize | null {
    if (mimetype === "image/png") return getPngSize(buffer);
    if (mimetype === "image/jpeg") return getJpegSize(buffer);
    return null;
}

// Spec PNG: 8 bytes de firma, luego el chunk IHDR (4 bytes de longitud + 4
// bytes "IHDR") antes de 4 bytes de ancho y 4 de alto, todo big-endian.
function getPngSize(buffer: Buffer): ImageSize | null {
    if (buffer.length < 24) return null;

    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
    };
}

// Spec JPEG: una secuencia de markers `0xFF <marker> <length> <payload>`.
// Las dimensiones están en el primer marker "Start Of Frame" (0xC0-0xCF,
// salvo 0xC4/0xC8/0xCC que no son SOF), como alto/ancho de 2 bytes cada uno.
function getJpegSize(buffer: Buffer): ImageSize | null {
    let offset = 2; // saltea el marker inicial 0xFFD8

    while (offset + 9 <= buffer.length) {
        if (buffer[offset] !== 0xff) return null;

        const marker = buffer[offset + 1];
        const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

        if (isStartOfFrame) {
            return {
                height: buffer.readUInt16BE(offset + 5),
                width: buffer.readUInt16BE(offset + 7)
            };
        }

        const segmentLength = buffer.readUInt16BE(offset + 2);
        offset += 2 + segmentLength;
    }

    return null;
}
