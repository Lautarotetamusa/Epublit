import type { LibroService } from "../../libro";
import type { Pagination } from "../../../lib/http/responses";
import { CatalogRepository } from "./catalog.repository";
import { toBookDetail, toBookSummary } from "./catalog.serializer";

export type CatalogServiceDeps = {
    libroService: LibroService;
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

export function createCatalogService({ libroService, repository }: CatalogServiceDeps) {
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

        const { libros } = await libroService.findCatalogoPaginated(filtros, pagination);

        return {
            libros: libros.map(({ libro, personas }) => toBookSummary(libro, personas)),
            total: pagination.total ?? libros.length,
            pagina: query.pagina,
            porPagina: query.porPagina
        };
    };

    const getBook = async (isbn: string, userId: number) => {
        const libro = await libroService.findOneWithPersonas(isbn, userId);
        return toBookDetail(libro);
    };

    return {
        getConfig,
        getBooks,
        getBook
    };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
