import { and, asc, eq, getTableColumns, inArray, isNull } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { Database, Tx } from "../../db/client";
import { librosTable } from "./libro.schema";
import { librosPersonasTable } from "./libroPersona.schema";
import { personasTable } from "../persona/persona.schema";
import { rolesTable } from "../rol/rol.schema";
import { coleccionesTable } from "../coleccion/coleccion.schema";
import { libroFilterMap } from "./libro.filter";
import { disponibleEnPrincipal, stockDeLibro, cantidadEnDeposito } from "./libro.stock";
import { Libro } from "./libro.validator";
import { NotFound } from "bradb";

export type LibroRepositoryDeps = {
    db: Database;
};

// Fila de libro con el título de su colección y su stock ya resueltos por
// join: `stock` es la suma de sus cantidades en todos los depósitos y
// `disponible_principal` la de su depósito principal (ver
// specs/008-movimientos-deposito). El libro ya no tiene stock propio.
export type LibroConColeccion = Omit<Libro, "stock"> & {
    stock: number;
    disponible_principal: number;
    coleccion_titulo: string | null;
};

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
                stock: stockDeLibro(),
                // Disponibilidad operativa: físico del principal menos
                // reservas activas del ecommerce (puede ser negativa).
                disponible_principal: disponibleEnPrincipal(),
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

    // Variant del select que incluye `disponible_en_deposito` (ver specs/018):
    // cantidad física del libro en un depósito específico. Se usa sólo cuando
    // el query param `deposito_id` está presente; la lectura habitual no trae
    // esta columna para no pagar el costo de la subquery innecesaria.
    const selectConColeccionYDeposito = (depositoId: number) =>
        db
            .select({
                ...getTableColumns(librosTable),
                stock: stockDeLibro(),
                disponible_principal: disponibleEnPrincipal(),
                coleccion_titulo: coleccionesTable.titulo,
                disponible_en_deposito: cantidadEnDeposito(depositoId)
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

    // Variantes con `disponible_en_deposito` para `GET /libro?deposito_id=N`
    // (ver specs/018): el depósito ya fue validado por el service (404 si no
    // existe o no es del usuario).
    // `builder.findAll` recibe una factory function que ejecuta `$dynamic()`
    // interno. La factory cierra sobre `depositoId` para incluir la columna
    // extra. `.orderBy()` se aplica igual que en `selectOrderedByTitulo`.
    const findAllOrderedWithDeposito = (
        depositoId: number,
        filters: Parameters<typeof findAllOrdered>[0]
    ) => {
        const selectFn = () => selectConColeccionYDeposito(depositoId).orderBy(librosTable.titulo);
        return builder.findAll(selectFn, false)(filters);
    };

    const findAllPaginatedWithDeposito = async (
        depositoId: number,
        filters: Parameters<typeof findAllPaginated>[0],
        pagination: Parameters<typeof findAllPaginated>[1]
    ) => {
        const selectFn = () => selectConColeccionYDeposito(depositoId).orderBy(librosTable.titulo);
        return builder.findAll(selectFn, true)(filters, pagination);
    };

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

    // Desasocia todas las personas actuales de un libro: usada por
    // `remove` (business) antes del soft delete, igual que `Libro.delete`
    // vía `LibroPersona._delete` en MySQL.
    const removeAllPersonas = async (idLibro: number, tx?: Tx) => {
        await (tx ?? db).delete(librosPersonasTable).where(eq(librosPersonasTable.id_libro, idLibro));
    };

    // Personas del libro en una única lista, cada una con el rol de la cuenta
    // (`{ id, nombre }`) leído del rol, no de un valor copiado en la relación:
    // la misma persona puede aparecer con roles distintos (ver specs/011-roles).
    // Se excluyen personas y roles dados de baja: el catálogo público sólo
    // expone vinculaciones vigentes (ver specs/016-tienda-ecommerce).
    const personasDeLibros = (idLibros: number[], userId: number) =>
        db
            .select({
                id_libro: librosPersonasTable.id_libro,
                id_persona: personasTable.id,
                dni: personasTable.dni,
                nombre: personasTable.nombre,
                email: personasTable.email,
                bio: personasTable.bio,
                foto_key: personasTable.foto_key,
                rol_id: rolesTable.id,
                rol_nombre: rolesTable.nombre,
                porcentaje: librosPersonasTable.porcentaje,
                monto_acordado: librosPersonasTable.monto_acordado
            })
            .from(librosPersonasTable)
            .innerJoin(personasTable, eq(personasTable.id, librosPersonasTable.id_persona))
            .innerJoin(rolesTable, and(eq(rolesTable.id, librosPersonasTable.id_rol), eq(rolesTable.user, userId)))
            .where(
                and(
                    inArray(librosPersonasTable.id_libro, idLibros),
                    eq(personasTable.user, userId),
                    isNull(personasTable.deletedAt),
                    isNull(rolesTable.deletedAt)
                )
            )
            .orderBy(asc(rolesTable.nombre), asc(personasTable.nombre));

    const toPersona = (persona: Awaited<ReturnType<typeof personasDeLibros>>[number]) => ({
        id_persona: persona.id_persona,
        dni: persona.dni,
        nombre: persona.nombre,
        email: persona.email,
        bio: persona.bio,
        foto_key: persona.foto_key,
        porcentaje: persona.porcentaje,
        monto_acordado: persona.monto_acordado,
        rol: { id: persona.rol_id, nombre: persona.rol_nombre }
    });

    const getPersonas = async (idLibro: number, userId: number) => {
        const personas = await personasDeLibros([idLibro], userId);
        return personas.map(toPersona);
    };

    // Versión bulk para el listado público: evita una query por libro y
    // devuelve cada persona con el id del libro al que pertenece.
    const getPersonasByLibros = async (idLibros: number[], userId: number) => {
        if (idLibros.length === 0) return [];

        const personas = await personasDeLibros(idLibros, userId);
        return personas.map((persona) => ({ id_libro: persona.id_libro, ...toPersona(persona) }));
    };

    return {
        findOne,
        findOneById,
        exists,
        findAllOrdered,
        findAllPaginated,
        findAllOrderedWithDeposito,
        findAllPaginatedWithDeposito,
        insert,
        update,
        remove,
        removeAllPersonas,
        getPersonas,
        getPersonasByLibros
    };
}

export type LibroRepository = ReturnType<typeof createLibroRepository>;
