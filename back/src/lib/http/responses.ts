import { Response } from "express";

// Estructuralmente igual al `Pagination` de bradb (`{page, pageSize, total?,
// count?}`): no se importa de ahí para que `lib/` no dependa de bradb, pero
// se puede pasar tal cual lo que devuelve `newPagination`/`ServiceBuilder`
// sin desenvolverlo.
export type Pagination = {
    page: number;
    pageSize: number;
    total?: number;
    count?: number;
};

// Único lugar donde se arma el sobre `{ success, message?, data }`: los
// otros helpers de acá abajo son casos particulares de éste (201, 200 con
// dato, 200 sin dato). Queda expuesto aparte para endpoints con un status
// distinto a esos.
export function success<T>(res: Response, status: number, data: T, message?: string): Response {
    return res.status(status).json({
        success: true,
        ...(message ? { message } : {}),
        data
    });
}

// Alta exitosa (POST): 201 con el recurso creado.
export function created<T>(res: Response, data: T, message?: string): Response {
    return success(res, 201, data, message);
}

// Traer un recurso (GET de uno solo): 200 con el dato.
export function ok<T>(res: Response, data: T, message?: string): Response {
    return success(res, 200, data, message);
}

// Actualización exitosa (PUT/PATCH): 200 con el recurso ya actualizado.
export function updated<T>(res: Response, data: T, message?: string): Response {
    return success(res, 200, data, message);
}

// Borrado exitoso (DELETE): 200 sin `data` (no hay recurso que devolver),
// sólo la confirmación. `data: undefined` no aparece en el JSON final
// (`res.json` lo omite), así que el sobre queda `{ success, message? }`.
export function deleted(res: Response, message?: string): Response {
    return success(res, 200, undefined, message);
}

// Listado (GET de muchos): 200 con paginación + items. Se le puede pasar
// directo el `Pagination` que ya trae `total`/`count` calculados (bradb los
// muta ahí mismo); si no vinieran, se completan con `items.length`.
export function list<T>(res: Response, items: T[], pagination: Pagination): Response {
    return res.status(200).json({
        pagination: {
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total ?? items.length,
            count: pagination.count ?? items.length
        },
        items
    });
}

// Listado paginado con el sobre `{success, data}` de arriba (a diferencia
// de `list()`, que no lo usa): `page`/`pageSize`/`total` quedan al mismo
// nivel que `data` porque así lo define el contrato de `GET /venta` (ver
// specs/002-filtro-ventas/plan.md, "Diseño de API").
export function paginated<T>(res: Response, data: T[], page: number, pageSize: number, total: number): Response {
    return res.status(200).json({
        success: true,
        data,
        page,
        pageSize,
        total
    });
}
