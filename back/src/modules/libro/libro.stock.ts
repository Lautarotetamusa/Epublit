import { sql } from "drizzle-orm";
import { librosTable } from "./libro.schema";
import { depositosTable } from "../deposito/deposito.schema";
import { depositoLibrosTable } from "../deposito/depositoLibros.schema";
import { reservationsTable } from "../tienda/stock/reservation.schema";

// Suma de las cantidades de un libro por depósito, como subquery escalar
// correlacionada contra `librosTable`: el libro ya no tiene stock propio (ver
// specs/008-movimientos-deposito). `soloPrincipal` limita la suma al depósito
// principal. Las reservas activas se descuentan en `disponibleEnPrincipal`,
// que es la definición que consumen las operaciones (ver
// specs/016-tienda-ecommerce).
export function stockDeLibro(soloPrincipal = false) {
    return sql<number>`(
        select coalesce(sum(${depositoLibrosTable.cantidad}), 0)
        from ${depositoLibrosTable}
        inner join ${depositosTable}
            on ${depositosTable.id} = ${depositoLibrosTable.deposito_id}
            and ${depositosTable.user} = ${depositoLibrosTable.user}
        where ${depositoLibrosTable.id_libro} = ${librosTable.id_libro}
            and ${depositoLibrosTable.user} = ${librosTable.user}
            and ${depositosTable.deletedAt} is null
            ${soloPrincipal ? sql`and ${depositosTable.principal} = true` : sql``}
    )`.mapWith(Number);
}

// Reservas todavía vigentes de un libro. Se usa como subquery correlacionada
// contra `librosTable`, tanto en las lecturas de libro como en el cálculo de
// disponibilidad del depósito principal.
export function reservasActivasDeLibro() {
    return sql<number>`(
        select coalesce(sum(${reservationsTable.cantidad}), 0)
        from ${reservationsTable}
        where ${reservationsTable.id_libro} = ${librosTable.id_libro}
            and ${reservationsTable.user} = ${librosTable.user}
            and ${reservationsTable.estado} = 'activa'
            and ${reservationsTable.expira_en} > now()
    )`.mapWith(Number);
}

// Disponibilidad del depósito principal: stock físico menos reservas activas.
// Puede ser negativa si el libro permite límite negativo.
export function disponibleEnPrincipal() {
    return sql<number>`(${stockDeLibro(true)} - ${reservasActivasDeLibro()})`.mapWith(Number);
}

// Cantidad de un libro en un depósito específico como subquery correlacionada
// contra `librosTable`: usado por `GET /libro?deposito_id=N` para exponer
// `disponible_en_deposito` junto a `disponible_principal` (ver specs/018).
// `depositoId` se resuelve en el scope de la query externa; si el libro no
// tiene presencia en ese depósito, la subquery devuelve 0.
export function cantidadEnDeposito(depositoId: number | bigint) {
    return sql<number>`(
        select coalesce(sum(${depositoLibrosTable.cantidad}), 0)
        from ${depositoLibrosTable}
        where ${depositoLibrosTable.id_libro} = ${librosTable.id_libro}
            and ${depositoLibrosTable.deposito_id} = ${depositoId}
            and ${depositoLibrosTable.user} = ${librosTable.user}
    )`.mapWith(Number);
}

// Cantidad que una operación puede vender desde el depósito principal: el
// disponible más el límite negativo permitido, nunca menor que cero. Es la
// única definición de la regla, compartida por catálogo, checkout y ventas
// internas (ver specs/016-tienda-ecommerce).
export function disponibleParaVenta(disponible: number, limiteNegativo: number): number {
    return Math.max(0, disponible + limiteNegativo);
}
