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

// Campos públicos comunes a listado y detalle. Nada de porcentajes, montos,
// email, dni, costo, stock por depósito ni datos fiscales.
const toBookBase = (libro: PublicLibro) => {
    const disponible = availableForSale(libro);

    return {
        isbn: libro.isbn,
        titulo: libro.titulo,
        precio: libro.precio,
        portadaUrl: libro.portada_url,
        disponibleParaVenta: disponible,
        enStock: disponible > 0
    };
};

export const toBookSummary = (libro: PublicLibro, personas: BookPerson[]) => ({
    ...toBookBase(libro),
    personas: sortPeople(personas).map(toPersonSummary)
});

export const toBookDetail = (libro: BookWithPeople) => ({
    ...toBookBase(libro),
    personas: sortPeople(libro.personas).map(toPersonDetail)
});
