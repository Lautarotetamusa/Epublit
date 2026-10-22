import { Pagination } from "bradb";
import { Storage } from "../../lib/storage";
import { Conflict, PayloadTooLarge, UnsupportedMediaType } from "../../lib/http/errors";
import { Coleccion, ColeccionInsert, ColeccionUpdate } from "./coleccion.validator";
import { ColeccionRepository } from "./coleccion.repository";

// Sólo estos dos tipos de imagen y hasta 5 MB: los mismos límites fijos de la
// portada de libro (ver specs/007-colecciones, "Decisiones").
const ALLOWED_PORTADA_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png"
};
const MAX_PORTADA_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type PortadaColeccionFile = {
    buffer: Buffer;
    mimetype: string;
    size: number;
};

// Shape que efectivamente devuelve el service (y por lo tanto la API):
// `portada_key` (detalle de storage) nunca sale de este archivo, y
// `cantidad_libros` se calcula acá, no se persiste.
export type PublicColeccion = Omit<Coleccion, "portada_key"> & {
    portada_url: string | null;
    cantidad_libros: number;
};

export type ColeccionLibro = {
    isbn: string;
    titulo: string;
    precio: number;
    portada_url: string | null;
};

export type ColeccionServiceDeps = {
    repository: ColeccionRepository;
    storage: Storage;
};

export function createColeccionService({ repository, storage }: ColeccionServiceDeps) {
    const toPublic = (coleccion: Coleccion, cantidadLibros: number): PublicColeccion => {
        const { portada_key, ...rest } = coleccion;
        return {
            ...rest,
            portada_url: portada_key ? storage.getUrl(portada_key) : null,
            cantidad_libros: cantidadLibros
        };
    };

    const toPublicWithCantidad = async (coleccion: Coleccion): Promise<PublicColeccion> =>
        toPublic(coleccion, await repository.countLibros(coleccion.id, coleccion.user));

    const toPublicLibro = (libro: { isbn: string; titulo: string; precio: number; portada_key: string | null }): ColeccionLibro => ({
        isbn: libro.isbn,
        titulo: libro.titulo,
        precio: libro.precio,
        portada_url: libro.portada_key ? storage.getUrl(libro.portada_key) : null
    });

    const create = async (data: ColeccionInsert, userId: number): Promise<PublicColeccion> => {
        const coleccion = await repository.insert({ ...data, user: userId });

        return toPublic(coleccion, 0);
    };

    const findAll = async (userId: number): Promise<PublicColeccion[]> => {
        const colecciones = await repository.findAll({ user: userId });
        const cantidades = await repository.countLibrosByColeccion(userId);

        return colecciones.map((coleccion) => toPublic(coleccion, cantidades.get(coleccion.id) ?? 0));
    };

    const findOne = async (id: number, userId: number): Promise<PublicColeccion> => {
        const coleccion = await repository.findOne({ id, user: userId });

        return toPublicWithCantidad(coleccion);
    };

    const update = async (id: number, userId: number, data: ColeccionUpdate): Promise<PublicColeccion> => {
        await repository.findOne({ id, user: userId });

        const updated = await repository.update({ id, user: userId }, data);

        return toPublic(updated, await repository.countLibros(id, userId));
    };

    // El rechazo es del servidor: la colección sólo se borra si ya no tiene
    // libros vigentes, sin importar lo que haya visto el front (ver plan,
    // tarea 6).
    const remove = async (id: number, userId: number): Promise<void> => {
        const coleccion = await repository.findOne({ id, user: userId });

        if ((await repository.countLibros(id, userId)) > 0) {
            throw new Conflict("No se puede eliminar una colección que todavía tiene libros");
        }

        await repository.remove({ id, user: userId });

        if (coleccion.portada_key) await storage.remove(coleccion.portada_key);
    };

    // Subida/reemplazo de portada: valida tipo/tamaño, escribe el archivo
    // nuevo y recién después borra el anterior, para no dejar la colección sin
    // portada si `storage.write` fallara (mismo patrón que libro/persona).
    const uploadPortada = async (id: number, userId: number, file: PortadaColeccionFile): Promise<PublicColeccion> => {
        const coleccion = await repository.findOne({ id, user: userId });

        const extension = ALLOWED_PORTADA_MIME[file.mimetype];
        if (!extension) {
            throw new UnsupportedMediaType("La portada debe ser una imagen JPG o PNG");
        }
        if (file.size > MAX_PORTADA_SIZE_BYTES) {
            throw new PayloadTooLarge("La portada no puede pesar más de 5 MB");
        }

        const key = `colecciones/portadas/${coleccion.id}-${Date.now()}.${extension}`;
        await storage.write(key, file.buffer);

        const updated = await repository.update({ id, user: userId }, { portada_key: key });

        if (coleccion.portada_key) {
            await storage.remove(coleccion.portada_key);
        }

        return toPublic(updated, await repository.countLibros(id, userId));
    };

    // Idempotente: quitar la portada de una colección que ya no tenía ninguna
    // sigue devolviendo 200 con `portada_url` en null (ver plan, tarea 8).
    const removePortada = async (id: number, userId: number): Promise<PublicColeccion> => {
        const coleccion = await repository.findOne({ id, user: userId });
        if (!coleccion.portada_key) return toPublicWithCantidad(coleccion);

        const updated = await repository.update({ id, user: userId }, { portada_key: null });

        await storage.remove(coleccion.portada_key);

        return toPublic(updated, await repository.countLibros(id, userId));
    };

    const getLibros = async (id: number, userId: number, pagination: Pagination): Promise<ColeccionLibro[]> => {
        // Valida que la colección exista y sea del usuario (404 si no).
        await repository.findOne({ id, user: userId });

        const libros = await repository.findLibrosPaginated(id, userId, pagination);

        return libros.map(toPublicLibro);
    };

    return {
        create,
        findAll,
        findOne,
        update,
        remove,
        uploadPortada,
        removePortada,
        getLibros
    };
}

export type ColeccionService = ReturnType<typeof createColeccionService>;
