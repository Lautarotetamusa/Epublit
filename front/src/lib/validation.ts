// CUIT argentino: 11 dígitos (el guionado es sólo de presentación, acá se
// valida sobre el valor ya sanitizado por sanitizeInteger).
export function isValidCuit(value: string): boolean {
    return /^\d{11}$/.test(value);
}

export function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Book trailer: sólo se acepta un link de YouTube (watch, youtu.be o
// embed), con o sin parámetros extra en la URL.
export function isValidYoutubeUrl(value: string): boolean {
    return /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/.test(value);
}
