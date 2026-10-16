import { pgTable, integer, real } from "drizzle-orm/pg-core";
import { movimientosTable } from "../movimiento/movimiento.schema";
import { clientesTable } from "../cliente/cliente.schema";
import { mediosPagoTable } from "../medioPago/medioPago.schema";

// Extensión 1:1 de un movimiento de venta: referencia al movimiento (guarda
// su id), así el ledger es la única fuente del historial (ver
// specs/009-ledger-unificado). Los datos propios de la venta —incluido el
// cliente— no viven en `movimientos`.
export const ventasTable = pgTable("ventas", {
    descuento: real("descuento").default(0),
    total: real("total").notNull(),
    // Medio de pago de la cuenta (ver specs/010-medios-pago): el ownership se
    // resuelve al leer (el medio es de la cuenta del movimiento dueño de la
    // venta), igual que el cliente.
    id_medio_pago: integer("id_medio_pago")
        .notNull()
        .references(() => mediosPagoTable.id),
    // Comisión vigente del medio al momento de vender (snapshot): el neto se
    // deriva de acá y no cambia si después se edita el medio.
    comision: real("comision").notNull().default(0),
    tipo_cbte: integer("tipo_cbte").notNull(),
    // Cliente comprador: FK a `clientes.id` (única). `ventas` no tiene columna
    // `user` (como la vieja `transacciones`), así que el ownership se resuelve
    // al leer: el join a `clientes` siempre va scopeado por el `user` del
    // movimiento dueño de la venta.
    id_cliente: integer("id_cliente")
        .notNull()
        .references(() => clientesTable.id),
    id_movimiento: integer("id_movimiento")
        .primaryKey()
        .references(() => movimientosTable.id)
});
