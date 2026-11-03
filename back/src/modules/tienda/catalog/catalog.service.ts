import type { LibroService } from "../../libro";
import type { ColeccionService } from "../../coleccion";
import type { Pagination } from "../../../lib/http/responses";
import { CatalogRepository } from "./catalog.repository";
import { toBookDetail, toBookSummary } from "./catalog.serializer";

export type CatalogServiceDeps = {
    libroService: LibroService;
    colecciones: Pick<ColeccionService, "findAll">;
    repository: CatalogRepository;
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

export function createCatalogService({ libroService, colecciones, repository }: CatalogServiceDeps) {
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
        getCollections
    };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
