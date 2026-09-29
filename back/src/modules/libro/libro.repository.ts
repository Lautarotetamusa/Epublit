import { and, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { Database, Tx } from "../../db/client";
import { librosTable } from "./libro.schema";
import { librosPersonasTable } from "./libroPersona.schema";
import { personasTable } from "../persona/persona.schema";
import { coleccionesTable } from "../coleccion/coleccion.schema";
import { libroFilterMap } from "./libro.filter";
import { Libro } from "./libro.validator";
import { tipoPersona } from "./libroPersona.validator";
import { NotFound } from "bradb";

export type LibroRepositoryDeps = {
    db: Database;
};

// Fila de libro con el título de su colección ya resuelto por el join:
// `coleccion_titulo` es null si el libro no tiene colección, si la colección
// no es del mismo usuario o si está borrada.
export type LibroConColeccion = Libro & { coleccion_titulo: string | null };

export function createLibroRepository({ db }: LibroRepositoryDeps) {
    const builder = new ServiceBuilder(db, librosTable, libroFilterMap);

    // Select base de toda lectura de libros: LEFT JOIN a `colecciones` (nunca
    // INNER: un libro sin colección desaparecería del listado) que trae
    // `coleccion_titulo` en el mismo SELECT, sin una segunda query. Las
    // condiciones de vigencia y de usuario de la colección van en el ON del
    // join para no descartar libros: si no matchean, el título queda null.
    const selectConColeccion = () =>
        db
            .select({
                ...getTableColumns(librosTable),
                coleccion_titulo: coleccionesTable.titulo
            })
            .from(librosTable)
            .leftJoin(
                coleccionesTable,
                and(
                    eq(coleccionesTable.id, librosTable.coleccion_id),
                    eq(coleccionesTable.user, librosTable.user),
                    isNull(coleccionesTable.deletedAt)
                )
            )
            .$dynamic();

    // Ordenado por título: mismo `ORDER BY titulo ASC` que el `Libro.getAll`
    // actual. `ServiceBuilder.findAll` no expone `orderBy` en su firma, así que
    // se resuelve con un `select` custom, igual que `selectWithoutPassword` en
    // `user.repository.ts`.
    const selectOrderedByTitulo = () => selectConColeccion().orderBy(librosTable.titulo);

    // Sin paginar: usada por el export a CSV (`listaLibros`), que necesita
    // todas las filas, no una página.
    const findAllOrdered = builder.findAll(selectOrderedByTitulo, false);

    // Paginada (bradb calcula `total`/`count` y los muta en `pagination`,
    // mismo mecanismo que `persona.repository.ts`): reemplaza a los dos modos
    // separados que tenía antes `GET /libro` (uno paginado sin filtros, uno
    // filtrado sin paginar) por uno solo, siempre paginado y filtrable.
    const findAllPaginated = builder.findAll(selectOrderedByTitulo, true);

    const update = builder.update();
    const insert = builder.create();
    const remove = builder.delete();

    // Los endpoints públicos siguen recibiendo `isbn` en la URL, no `id_libro`
    // (interno): bradb's `findOne(pk)` necesita `id_libro`, así que la búsqueda
    // pública se resuelve con una query propia.
    const findOne = async (isbn: string, userId: number): Promise<LibroConColeccion> => {
        const rows = await selectConColeccion().where(
            and(eq(librosTable.isbn, isbn), eq(librosTable.user, userId), isNull(librosTable.deletedAt))
        );

        if (rows.length === 0) throw new NotFound(`No existe un libro con isbn ${isbn}`);
        return rows[0];
    };

    // Relee por la PK interna (`id_libro`): la usan create/update/uploadPortada
    // para devolver `coleccion_titulo` ya resuelto por el join, incluso si el
    // PUT cambió el isbn del libro.
    const findOneById = async (idLibro: number, userId: number): Promise<LibroConColeccion> => {
        const rows = await selectConColeccion().where(
            and(eq(librosTable.id_libro, idLibro), eq(librosTable.user, userId), isNull(librosTable.deletedAt))
        );

        if (rows.length === 0) throw new NotFound(`No existe un libro con id ${idLibro}`);
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

    // Desasocia autores/ilustradores actuales de un libro: usada por
    // `remove` (business) antes del soft delete, igual que `Libro.delete`
    // vía `LibroPersona._delete` en MySQL.
    const removeAllPersonas = async (idLibro: number, tx?: Tx) => {
        await (tx ?? db).delete(librosPersonasTable).where(eq(librosPersonasTable.id_libro, idLibro));
    };

    const getPersonas = async (idLibro: number, userId: number) => {
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
            .where(and(eq(librosPersonasTable.id_libro, idLibro), eq(personasTable.user, userId)));

        return {
            autores: personas.filter((p) => p.tipo === tipoPersona.autor),
            ilustradores: personas.filter((p) => p.tipo === tipoPersona.ilustrador)
        };
    };

    // Reemplaza `Libro.updateStock` (MySQL), sin equivalente hoy en Postgres.
    // Incremento atómico en SQL (`stock = stock + delta`), no lectura-modificación-
    // escritura en JS, para no perder actualizaciones concurrentes.
    const moveStock = async (idLibro: number, delta: number, tx?: Tx): Promise<void> => {
        await (tx ?? db)
            .update(librosTable)
            .set({ stock: sql`${librosTable.stock} + ${delta}` })
            .where(eq(librosTable.id_libro, idLibro));
    };

    return {
        findOne,
        findOneById,
        exists,
        findAllOrdered,
        findAllPaginated,
        insert,
        update,
        remove,
        removeAllPersonas,
        getPersonas,
        moveStock
    };
}

export type LibroRepository = ReturnType<typeof createLibroRepository>;
