import { Database } from "../../db/client";
import { LibroInsert, LibroUpdate } from "./libro.validator";
import { LibroPrecioRepository } from "./libroPrecio.repository";
import { LibroRepository } from "./libro.repository";
import { Duplicated } from "bradb";

export type LibroServiceDeps = {
    db: Database;
    repository: LibroRepository;
    libroPrecioRepository: LibroPrecioRepository;
};

export function createLibroService({ db, repository, libroPrecioRepository }: LibroServiceDeps) {
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

            return libro;
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

        return repository.update({ id_libro: libro.id_libro, user: userId }, body);
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

        return { ...libro, autores, ilustradores };
    };

    return {
        findOne: repository.findOne,
        findOneWithPersonas,
        exists: repository.exists,
        findAllOrdered: repository.findAllOrdered,
        findAllPaginated: repository.findAllPaginated,
        create,
        update,
        remove,
        getPersonas: repository.getPersonas,
        // Ya viene ordenado del más reciente al más antiguo desde `libroPrecioRepository`.
        getPrecios: libroPrecioRepository.getByIsbn,
        moveStock: repository.moveStock
    };
}

export type LibroService = ReturnType<typeof createLibroService>;
