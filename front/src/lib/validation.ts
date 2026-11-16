// CUIT argentino: 11 dígitos (el guionado es sólo de presentación, acá se
// valida sobre el valor ya sanitizado por sanitizeInteger).
export function isValidCuit(value: string): boolean {
    return /^\d{11}$/.test(value);
}

// Se valida sobre el valor sin espacios en los extremos: un dato viejo que
// arrastra un " " o un "\n" al final (invisible en un input type="email", que
// no dibuja los saltos de línea) no es otro email, y no tiene por qué dejar el
// formulario inválido para siempre.
export function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Book trailer: sólo se acepta un link de YouTube (watch, youtu.be o
// embed), con o sin parámetros extra en la URL.
export function isValidYoutubeUrl(value: string): boolean {
    return /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/.test(value);
}

// Reseña de un libro: cualquier link http(s), mismo criterio que el backend
// (libroResena.validator.ts).
export function isValidWebUrl(value: string): boolean {
    return URL.canParse(value.trim()) && /^https?:$/.test(new URL(value.trim()).protocol);
}
