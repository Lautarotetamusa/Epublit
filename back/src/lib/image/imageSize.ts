// Lector mínimo de dimensiones PNG/JPEG/WebP (los formatos que acepta el CMS
// de contenido; persona sigue aceptando sólo PNG/JPEG): evita traer una
// dependencia nueva sólo para leer un header de imagen.
export type ImageSize = { width: number; height: number };
export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

const esPng = (buffer: Buffer): boolean =>
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer.toString("ascii", 1, 4) === "PNG" &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

const esJpeg = (buffer: Buffer): boolean =>
    buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

const esWebp = (buffer: Buffer): boolean =>
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

// El formato se detecta por los bytes reales: la extensión o el Content-Type
// declarado no alcanzan para aceptar un archivo.
export function detectImageFormat(buffer: Buffer): ImageFormat | null {
    if (esPng(buffer)) return "image/png";
    if (esJpeg(buffer)) return "image/jpeg";
    if (esWebp(buffer)) return "image/webp";
    return null;
}

export function getImageSize(buffer: Buffer, mimetype: string): ImageSize | null {
    if (mimetype === "image/png") return getPngSize(buffer);
    if (mimetype === "image/jpeg") return getJpegSize(buffer);
    if (mimetype === "image/webp") return getWebpSize(buffer);
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

// WebP tiene tres variantes de header. VP8X (extendido) guarda el canvas en
// 24 bits little-endian; VP8 (lossy) y VP8L (lossless) usan 14 bits.
function getWebpSize(buffer: Buffer): ImageSize | null {
    if (buffer.length < 30) return null;

    const formato = buffer.toString("ascii", 12, 16);

    if (formato === "VP8X") {
        return {
            width: 1 + buffer.readUIntLE(24, 3),
            height: 1 + buffer.readUIntLE(27, 3)
        };
    }

    if (formato === "VP8 ") {
        return {
            width: buffer.readUInt16LE(26) & 0x3fff,
            height: buffer.readUInt16LE(28) & 0x3fff
        };
    }

    if (formato === "VP8L") {
        const bits = buffer.readUInt32LE(21);
        return {
            width: (bits & 0x3fff) + 1,
            height: ((bits >> 14) & 0x3fff) + 1
        };
    }

    return null;
}
