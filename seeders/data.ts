// Datos de ejemplo compartidos entre seeders: mantenerlos en un solo lugar
// evita que cada seeder invente sus propios nombres/isbn/dni (DRY).

export const NOMBRES = [
    "Ana", "Bruno", "Carla", "Diego", "Elena", "Facundo", "Gabriela", "Hernán",
    "Irene", "Javier", "Karina", "Lucas", "Marina", "Nicolás", "Ornella", "Pablo"
];

export const APELLIDOS = [
    "Gómez", "Fernández", "Rodríguez", "López", "Martínez", "Pérez", "García",
    "Sánchez", "Romero", "Torres", "Flores", "Acosta", "Benítez", "Suárez"
];

export const CIUDADES = [
    "Rosario, Santa Fe",
    "Córdoba, Córdoba",
    "La Plata, Buenos Aires",
    "Mendoza, Mendoza",
    "Neuquén, Neuquén",
    "Salta, Salta"
];

export const TITULOS_LIBRO = [
    "El jardín de los senderos",
    "Cuentos de la frontera",
    "Historia mínima del país",
    "Manual de introducción a la física",
    "Poemas del sur",
    "La casa vacía",
    "Relatos de invierno",
    "Fundamentos de economía",
    "El último viaje",
    "Diario de un lector",
    "Cartas desde el río",
    "Breve historia del cine"
];

// `nombre completo` determinístico a partir de un índice: mismo índice
// siempre da el mismo nombre, para poder correr el seeder de forma
// reproducible sin coordinar contadores entre seeders.
export function nombreCompleto(indice: number): string {
    const nombre = NOMBRES[indice % NOMBRES.length];
    const apellido = APELLIDOS[(indice * 7) % APELLIDOS.length];
    return `${nombre} ${apellido}`;
}

export function domicilio(indice: number, calle: string): string {
    return `${calle} ${100 + indice * 10}, ${CIUDADES[indice % CIUDADES.length]}`;
}

export function dni(indice: number): string {
    return String(20000000 + indice);
}

export function cuit(indice: number): string {
    return `20${String(30000000 + indice).padStart(8, "0")}3`;
}

export function isbn(indice: number): string {
    return `978${String(1000000000 + indice).slice(0, 10)}`;
}

export function email(usuario: string, indice: number): string {
    return `${usuario}${indice}@epublit.test`;
}
