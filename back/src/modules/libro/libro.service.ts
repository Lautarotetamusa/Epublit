import { Database } from "../../db/client";
import { Libro, LibroInsert, LibroUpdate } from "./libro.validator";
import { LibroPrecioRepository } from "./libroPrecio.repository";
import { LibroRepository } from "./libro.repository";
import { Storage } from "../../lib/storage";
import { UnsupportedMediaType, PayloadTooLarge } from "../../lib/http/errors";
import { Duplicated } from "bradb";

// Sólo estos dos tipos de imagen (ver plan specs/003-libro-campos-extendidos).
const ALLOWED_PORTADA_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png"
};
const MAX_PORTADA_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type PortadaFile = {
    buffer: Buffer;
    mimetype: string;
    size: number;
};

// Shape que efectivamente devuelve el service (y por lo tanto la API):
// `portada_key` (detalle de storage) nunca sale de este archivo.
export type PublicLibro = Omit<Libro, "portada_key"> & { portada_url: string | null };

export type LibroServiceDeps = {
    db: Database;
    repository: LibroRepository;
    libroPrecioRepository: LibroPrecioRepository;
    storage: Storage;
};

export function createLibroService({ db, repository, libroPrecioRepository, storage }: LibroServiceDeps) {
    // Shape público de un libro: cambia `portada_key` (detalle de storage)
    // por `portada_url` (utilizable directo por el front), igual que
    // `operacion.service.ts` con los comprobantes.
    const toPublic = (libro: Libro): PublicLibro => {
        const { portada_key, ...rest } = libro;
        return { ...rest, portada_url: portada_key ? storage.getUrl(portada_key) : null };
    };
    const toPublicList = (libros: Libro[]): PublicLibro[] => libros.map(toPublic);

    const create = async (data: LibroInsert, userId: number) => {
        if (await repository.exists(data.isbn, userId)) {
            throw new Duplicated(`El libro con isbn ${data.isbn} ya existe`);
        }

        return db.transaction(async (tx) => {
            const libro = await repository.insert({ ...data, user: userId }, tx);

            await libroPrecioRepository.insert(
                {
                    isbn: libro.isbn,
                    precio: libro.precio,
                    user: userId,
                    id_libro: libro.id_libro
                },
                tx
            );

            return toPublic(libro);
        });
    };

    const update = async (isbn: string, userId: number, body: LibroUpdate) => {
        const libro = await repository.findOne(isbn, userId);

        // Sólo se agrega un registro nuevo al historial si el precio realmente
        // cambió (ver spec, "Casos borde").
        if (body.precio !== undefined && body.precio !== libro.precio) {
            await libroPrecioRepository.insert({
                isbn,
                precio: body.precio,
                user: userId,
                id_libro: libro.id_libro
            });
        }

        const updated = await repository.update({ id_libro: libro.id_libro, user: userId }, body);
        return toPublic(updated);
    };

    const remove = async (isbn: string, userId: number): Promise<void> => {
        const libro = await repository.findOne(isbn, userId);

        await repository.removeAllPersonas(libro.id_libro);
        await repository.remove({ id_libro: libro.id_libro, user: userId });
    };

    // Compone `findOne` + `getPersonas`: antes el controller hacía las dos
    // llamadas y las combinaba a mano.
    const findOneWithPersonas = async (isbn: string, userId: number) => {
        const libro = await repository.findOne(isbn, userId);
        const { autores, ilustradores } = await repository.getPersonas(libro.id_libro, userId);

        return { ...toPublic(libro), autores, ilustradores };
    };

    const findAllOrderedPublic = async (filters: Parameters<LibroRepository["findAllOrdered"]>[0]) =>
        toPublicList(await repository.findAllOrdered(filters));

    const findAllPaginatedPublic = async (
        filters: Parameters<LibroRepository["findAllPaginated"]>[0],
        pagination: Parameters<LibroRepository["findAllPaginated"]>[1]
    ) => toPublicList(await repository.findAllPaginated(filters, pagination));

    // Subida/reemplazo de portada (ver plan specs/003-libro-campos-extendidos):
    // valida tipo/tamaño, escribe el archivo nuevo y recién después borra el
    // anterior, para no dejar el libro sin portada si `storage.write` fallara.
    const uploadPortada = async (isbn: string, userId: number, file: PortadaFile) => {
        const libro = await repository.findOne(isbn, userId);

        const extension = ALLOWED_PORTADA_MIME[file.mimetype];
        if (!extension) {
            throw new UnsupportedMediaType("La portada debe ser una imagen JPG o PNG");
        }
        if (file.size > MAX_PORTADA_SIZE_BYTES) {
            throw new PayloadTooLarge("La portada no puede pesar más de 5 MB");
        }

        const key = `libros/portadas/${libro.id_libro}-${Date.now()}.${extension}`;
        await storage.write(key, file.buffer);

        const updated = await repository.update({ id_libro: libro.id_libro, user: userId }, { portada_key: key });

        if (libro.portada_key) {
            await storage.remove(libro.portada_key);
        }

        return toPublic(updated);
    };

    return {
        findOne: repository.findOne,
        findOneWithPersonas,
        exists: repository.exists,
        findAllOrdered: findAllOrderedPublic,
        findAllPaginated: findAllPaginatedPublic,
        create,
        update,
        remove,
        uploadPortada,
        getPersonas: repository.getPersonas,
        // Ya viene ordenado del más reciente al más antiguo desde `libroPrecioRepository`.
        getPrecios: libroPrecioRepository.getByIsbn,
        moveStock: repository.moveStock
    };
}

export type LibroService = ReturnType<typeof createLibroService>;
