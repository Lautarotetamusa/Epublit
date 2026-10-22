import { sql } from "drizzle-orm";
import { librosTable } from "./libro.schema";
import { depositosTable } from "../deposito/deposito.schema";
import { depositoLibrosTable } from "../deposito/depositoLibros.schema";

// Suma de las cantidades de un libro por depósito, como subquery escalar
// correlacionada contra `librosTable`: el libro ya no tiene stock propio (ver
// specs/008-movimientos-deposito). `soloPrincipal` limita la suma al depósito
// principal del usuario. Es la única definición del stock derivado: la usan
// los listados de libro, el filtro por stock y las lecturas de otros módulos
// que hoy exponen `stock` por libro.
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
