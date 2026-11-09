import type { PublicLibro } from "../../libro";
import { disponibleParaVenta } from "../../libro/libro.stock";

type BookPerson = {
    nombre: string;
    bio: string | null;
    foto_url: string | null;
    rol: { id: number; nombre: string };
};

type BookWithPeople = PublicLibro & { personas: BookPerson[] };

const sortPeople = (personas: BookPerson[]) =>
    [...personas].sort(
        (a, b) =>
            a.rol.nombre.localeCompare(b.rol.nombre, "es") ||
            a.nombre.localeCompare(b.nombre, "es")
    );

const toPersonSummary = (persona: BookPerson) => ({
    nombre: persona.nombre,
    rol: persona.rol.nombre,
    ...(persona.foto_url ? { fotoUrl: persona.foto_url } : {})
});

const toPersonDetail = (persona: BookPerson) => ({
    nombre: persona.nombre,
    rol: persona.rol.nombre,
    ...(persona.foto_url ? { fotoUrl: persona.foto_url } : {}),
    ...(persona.bio ? { bio: persona.bio } : {})
});

const availableForSale = (libro: PublicLibro) =>
    disponibleParaVenta(libro.disponible_principal, libro.stock_negativo_permitido);

export type PublicPersonaLibro = {
    isbn: string;
    titulo: string;
    portadaUrl: string | null;
    fechaEdicion: string;
};

export type PublicPersona = {
    id: number;
    slug: string;
    nombre: string;
    bio: string | null;
    fotoUrl: string | null;
    roles: string[];
    libros: PublicPersonaLibro[];
};

// Slug estable para la URL pública de la persona. Si dos personas de la
// cuenta comparten nombre, el service agrega el id para desambiguar.
export const slugifyPersona = (nombre: string) =>
    nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "persona";

// Campos públicos comunes a listado y detalle. Nada de porcentajes, montos,
// email, dni, costo, stock por depósito ni datos fiscales.
const toColeccion = (libro: PublicLibro) =>
    libro.coleccion_id ? { id: libro.coleccion_id, titulo: libro.coleccion_titulo } : null;

const toBookBase = (libro: PublicLibro) => {
    const disponible = availableForSale(libro);

    return {
        isbn: libro.isbn,
        titulo: libro.titulo,
        precio: libro.precio,
        portadaUrl: libro.portada_url,
        disponibleParaVenta: disponible,
        enStock: disponible > 0,
        coleccion: toColeccion(libro),
        // Rango de edad recomendada: cualquiera de los dos extremos puede ser
        // null ("0 a 3", "+8", sin dato).
        edadMin: libro.edad_min,
        edadMax: libro.edad_max,
        fechaEdicion: libro.fecha_edicion
    };
};

export const toBookSummary = (libro: PublicLibro, personas: BookPerson[], novedad: boolean) => ({
    ...toBookBase(libro),
    // Los últimos 3 libros creados (ver catalog.repository#findUltimosIds).
    novedad,
    personas: sortPeople(personas).map(toPersonSummary)
});

export const toBookDetail = (libro: BookWithPeople, novedad: boolean) => ({
    ...toBookBase(libro),
    novedad,
    // Ficha completa: el storefront la usa en la página de detalle. Son datos
    // editoriales, no internos (no hay costos ni porcentajes acá).
    brief: libro.brief,
    paginas: libro.paginas,
    alto: libro.alto,
    ancho: libro.ancho,
    largo: libro.largo,
    bookTrailerUrl: libro.book_trailer_url,
    personas: sortPeople(libro.personas).map(toPersonDetail)
});
