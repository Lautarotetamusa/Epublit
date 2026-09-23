import { and, eq, isNull, sql } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { db } from "../pgDb";
import { librosTable } from "../schemas/libros.schema";
import { precioLibrosTable } from "../schemas/precioLibros.schema";
import { librosPersonasTable } from "../schemas/librosPersonas.schema";
import { personasTable } from "../schemas/personas.schema";
import { libroFilterMap } from "../filters/libro.filter";
import { Libro, LibroInsert, LibroUpdate } from "../validators/libro.validator";
import { tipoPersona } from "../validators/libro_persona.validator";
import { libroPrecioService } from "./libroPrecio.service";
import { Tx } from "./operacion.types";
import { NotFound } from "../models/errors";

const builder = new ServiceBuilder(db, librosTable, libroFilterMap);

// Ordenado por título: mismo `ORDER BY titulo ASC` que el `Libro.getAll`
// actual. `ServiceBuilder.findAll` no expone `orderBy` en su firma, así que
// se resuelve con un `select` custom, igual que `selectWithoutPassword` en
// `user.service.ts`.
const selectOrderedByTitulo = () => db.select().from(librosTable).orderBy(librosTable.titulo).$dynamic();
const findAllFiltered = builder.findAll(selectOrderedByTitulo, false);

const findAllPaginatedRaw = builder.findAll(true);
const librosPorPagina = 10;
// El `page` que llega hoy desde `GET /libro?page=` es 0-indexado (offset =
// page * 10, ver `Libro.getPaginated` actual); bradb pagina 1-indexado
// (offset = (page - 1) * pageSize), de ahí el +1.
const findAllPaginated = async (userId: number, page: number) => {
    return findAllPaginatedRaw({ user: userId }, { page: page + 1, pageSize: librosPorPagina });
};

const update = builder.update();
const remove = builder.delete();

// Los endpoints públicos siguen recibiendo `isbn` en la URL, no `id_libro`
// (interno): bradb's `findOne(pk)` necesita `id_libro`, así que la búsqueda
// pública se resuelve con una query propia.
const findOne = async (isbn: string, userId: number): Promise<Libro> => {
    const rows = await db
        .select()
        .from(librosTable)
        .where(and(eq(librosTable.isbn, isbn), eq(librosTable.user, userId), isNull(librosTable.deletedAt)));

    if (rows.length === 0) throw new NotFound(`No existe un libro con isbn ${isbn}`);
    return rows[0];
};

const exists = async (isbn: string, userId: number): Promise<boolean> => {
    const rows = await db
        .select({ id_libro: librosTable.id_libro })
        .from(librosTable)
        .where(and(eq(librosTable.isbn, isbn), eq(librosTable.user, userId), isNull(librosTable.deletedAt)))
        .limit(1);

    return rows.length > 0;
};

// El alta de un libro no toca `personasTable`/`librosPersonasTable`: la
// asociación de autores/ilustradores es responsabilidad exclusiva de
// `libro_persona` (ver spec/plan, sección "Decisiones y trade-offs").
const create = async (data: LibroInsert, userId: number): Promise<Libro> => {
    return db.transaction(async (tx) => {
        const [libro] = await tx.insert(librosTable).values({ ...data, user: userId }).returning();

        await tx.insert(precioLibrosTable).values({
            isbn: libro.isbn,
            precio: libro.precio,
            user: userId,
            id_libro: libro.id_libro
        });

        return libro;
    });
};

const updateLibro = async (isbn: string, userId: number, body: LibroUpdate): Promise<Libro> => {
    const libro = await findOne(isbn, userId);

    // Sólo se agrega un registro nuevo al historial si el precio realmente
    // cambió (ver spec, "Casos borde").
    if (body.precio !== undefined && body.precio !== libro.precio) {
        await libroPrecioService.insert({
            isbn,
            precio: body.precio,
            user: userId,
            id_libro: libro.id_libro
        });
    }

    return update({ id_libro: libro.id_libro, user: userId }, body);
};

const removeLibro = async (isbn: string, userId: number): Promise<void> => {
    const libro = await findOne(isbn, userId);

    // Desasocia autores/ilustradores actuales antes del soft delete del
    // libro, igual que `Libro.delete` vía `LibroPersona._delete` en MySQL.
    await db.delete(librosPersonasTable).where(eq(librosPersonasTable.id_libro, libro.id_libro));

    await remove({ id_libro: libro.id_libro, user: userId });
};

const getPersonas = async (isbn: string, userId: number) => {
    const libro = await findOne(isbn, userId);

    const personas = await db
        .select({
            id_persona: personasTable.id,
            dni: personasTable.dni,
            nombre: personasTable.nombre,
            email: personasTable.email,
            tipo: librosPersonasTable.tipo,
            porcentaje: librosPersonasTable.porcentaje
        })
        .from(librosPersonasTable)
        .innerJoin(personasTable, eq(personasTable.id, librosPersonasTable.id_persona))
        .where(and(eq(librosPersonasTable.id_libro, libro.id_libro), eq(personasTable.user, userId)));

    return {
        autores: personas.filter((p) => p.tipo === tipoPersona.autor),
        ilustradores: personas.filter((p) => p.tipo === tipoPersona.ilustrador)
    };
};

// Ya viene ordenado del más reciente al más antiguo desde `libroPrecioService`.
const getPrecios = libroPrecioService.getByIsbn;

// Reemplaza `Libro.updateStock` (MySQL), sin equivalente hoy en Postgres.
// Incremento atómico en SQL (`stock = stock + delta`), no lectura-modificación-
// escritura en JS, para no perder actualizaciones concurrentes.
const moveStock = async (idLibro: number, delta: number, tx?: Tx): Promise<void> => {
    await (tx ?? db)
        .update(librosTable)
        .set({ stock: sql`${librosTable.stock} + ${delta}` })
        .where(eq(librosTable.id_libro, idLibro));
};

export const libroService = {
    findOne,
    exists,
    findAllFiltered,
    findAllPaginated,
    create,
    update: updateLibro,
    remove: removeLibro,
    getPersonas,
    getPrecios,
    moveStock
};
