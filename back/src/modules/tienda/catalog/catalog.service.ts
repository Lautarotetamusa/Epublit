import type { LibroService } from "../../libro";
import type { ColeccionService } from "../../coleccion";
import type { Pagination } from "../../../lib/http/responses";
import type { Storage } from "../../../lib/storage/storage";
import { CatalogRepository } from "./catalog.repository";
import { slugifyPersona, toBookDetail, toBookSummary } from "./catalog.serializer";

export type CatalogServiceDeps = {
    libroService: LibroService;
    colecciones: Pick<ColeccionService, "findAll">;
    repository: CatalogRepository;
    storage: Storage;
};

export type CatalogQuery = {
    buscar?: string;
    pagina: number;
    porPagina: number;
};

const paginacion = (query: CatalogQuery): Pagination => ({
    page: query.pagina,
    pageSize: query.porPagina
});

export function createCatalogService({ libroService, colecciones, repository, storage }: CatalogServiceDeps) {
    const getConfig = async (userId: number) => {
        const { envio, mercadoPagoConnected } = await repository.getConfiguration(userId);

        const retiro = { disponible: false };
        if (envio?.retiro_activo) {
            Object.assign(retiro, {
                disponible: true,
                direccion: envio.retiro_direccion,
                horario: envio.retiro_horario
            });
        }

        return {
            moneda: "ARS",
            mercadopago: { disponible: mercadoPagoConnected },
            envio: {
                disponible: Boolean(
                    envio?.micorreo_usuario &&
                        envio.micorreo_credencial_cifrada &&
                        envio.micorreo_customer_id &&
                        envio.paqar_agreement &&
                        envio.paqar_api_key_cifrada &&
                        envio.paqar_seller_id &&
                        envio.origen_codigo_postal
                )
            },
            retiro
        };
    };

    const getBooks = async (userId: number, query: CatalogQuery) => {
        const pagination = paginacion(query);
        const filtros = {
            user: userId,
            ...(query.buscar ? { buscar: query.buscar } : {})
        };

        const [{ libros }, ultimos] = await Promise.all([
            libroService.findCatalogoPaginated(filtros, pagination),
            repository.findUltimosIds(userId, 3)
        ]);
        const idsNovedad = new Set(ultimos);

        return {
            libros: libros.map(({ libro, personas }) =>
                toBookSummary(libro, personas, idsNovedad.has(libro.id_libro))
            ),
            total: pagination.total ?? libros.length,
            pagina: query.pagina,
            porPagina: query.porPagina
        };
    };

    const getBook = async (isbn: string, userId: number) => {
        const [libro, ultimos] = await Promise.all([
            libroService.findOneWithPersonas(isbn, userId),
            repository.findUltimosIds(userId, 3)
        ]);

        return toBookDetail(libro, ultimos.includes(libro.id_libro));
    };

    // Personas con al menos un libro activo, pensadas para la página pública
    // de Autorxs: nombre, bio, foto, roles y sus libros. La misma persona
    // puede tener varios roles y varios libros; se agrupa acá.
    const getPersonas = async (userId: number) => {
        const filas = await repository.findPersonas(userId);
        const grupos = new Map<
            number,
            {
                id: number;
                nombre: string;
                bio: string | null;
                foto_key: string | null;
                roles: Set<string>;
                libros: Map<
                    string,
                    {
                        isbn: string;
                        titulo: string;
                        portada_key: string | null;
                        fecha_edicion: string;
                    }
                >;
            }
        >();

        for (const fila of filas) {
            const grupo = grupos.get(fila.id_persona) ?? {
                id: fila.id_persona,
                nombre: fila.nombre,
                bio: fila.bio,
                foto_key: fila.foto_key,
                roles: new Set<string>(),
                libros: new Map()
            };

            grupo.roles.add(fila.rol);
            grupo.libros.set(fila.isbn, {
                isbn: fila.isbn,
                titulo: fila.titulo,
                portada_key: fila.portada_key,
                fecha_edicion: fila.fecha_edicion
            });
            grupos.set(fila.id_persona, grupo);
        }

        const slugsUsados = new Set<string>();
        const personas = [...grupos.values()]
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
            .map((persona) => {
                const base = slugifyPersona(persona.nombre);
                let slug = base;
                if (slugsUsados.has(slug)) slug = `${base}-${persona.id}`;
                slugsUsados.add(slug);

                return {
                    id: persona.id,
                    slug,
                    nombre: persona.nombre,
                    bio: persona.bio,
                    fotoUrl: persona.foto_key ? storage.getUrl(persona.foto_key) : null,
                    roles: [...persona.roles].sort((a, b) => a.localeCompare(b, "es")),
                    libros: [...persona.libros.values()].map((libro) => ({
                        isbn: libro.isbn,
                        titulo: libro.titulo,
                        portadaUrl: libro.portada_key ? storage.getUrl(libro.portada_key) : null,
                        fechaEdicion: libro.fecha_edicion
                    }))
                };
            });

        return { personas };
    };

    // Las colecciones de la cuenta, con su portada y cantidad de libros. El
    // storefront arma con esto la sección de colecciones y los filtros.
    const getCollections = async (userId: number) => {
        const delUsuario = await colecciones.findAll(userId);

        return {
            colecciones: delUsuario.map((coleccion) => ({
                id: coleccion.id,
                titulo: coleccion.titulo,
                descripcion: coleccion.descripcion,
                portadaUrl: coleccion.portada_url,
                cantidadLibros: coleccion.cantidad_libros
            }))
        };
    };

    return {
        getConfig,
        getBooks,
        getBook,
        getPersonas,
        getCollections
    };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
