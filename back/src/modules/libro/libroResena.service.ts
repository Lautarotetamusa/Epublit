import { LibroRepository } from "./libro.repository";
import { LibroResenaRepository } from "./libroResena.repository";

export type LibroResenaServiceDeps = {
    repository: LibroResenaRepository;
    // Resuelve el isbn público al `id_libro` interno y da 404 si el libro no
    // existe o es de otra cuenta.
    libroRepository: Pick<LibroRepository, "findOne">;
};

export function createLibroResenaService({ repository, libroRepository }: LibroResenaServiceDeps) {
    const idDelLibro = async (isbn: string, userId: number) => (await libroRepository.findOne(isbn, userId)).id_libro;

    const listar = async (isbn: string, userId: number) => repository.findByLibro(await idDelLibro(isbn, userId), userId);

    const crear = async (isbn: string, userId: number, url: string) => repository.insert(await idDelLibro(isbn, userId), url, userId);

    const editar = async (isbn: string, id: number, userId: number, url: string) =>
        repository.update(id, await idDelLibro(isbn, userId), url, userId);

    const borrar = async (isbn: string, id: number, userId: number) => repository.remove(id, await idDelLibro(isbn, userId), userId);

    return { listar, crear, editar, borrar };
}

export type LibroResenaService = ReturnType<typeof createLibroResenaService>;
