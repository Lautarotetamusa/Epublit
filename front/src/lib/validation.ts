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

// El email es el usuario de las cuentas nuevas: "Ana@Editorial.com " y
// "ana@editorial.com" tienen que ser la misma cuenta.
export function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

export const PASSWORD_MIN_LENGTH = 8;

export function getEmailError(email: string): string | null {
    if (email.trim() === "") return "Ingresá tu email.";
    if (!isValidEmail(email)) return "Revisá el email: tiene que ser como nombre@editorial.com.ar.";
    return null;
}

export function getPasswordError(password: string): string | null {
    if (password === "") return "Elegí una contraseña.";
    if (password.length < PASSWORD_MIN_LENGTH) return `La contraseña tiene que tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
    return null;
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
