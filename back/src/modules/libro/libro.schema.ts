import { pgTable, integer, varchar, date, real, text, timestamp, primaryKey, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "../user/user.schema";
import { coleccionesTable } from "../coleccion/coleccion.schema";

export const librosTable = pgTable(
    "libros",
    {
        // `.unique()` además de la PK compuesta: precio_libros.id_libro,
        // libros_personas.id_libro y libro_cliente.id_libro referencian esta
        // columna sola, y Postgres exige unicidad para el FK.
        id_libro: integer("id_libro").generatedAlwaysAsIdentity().unique(),
        isbn: varchar("isbn", { length: 13 }).notNull(),
        titulo: varchar("titulo", { length: 60 }).notNull(),
        fecha_edicion: date("fecha_edicion").notNull(),
        precio: real("precio").notNull(),
        stock: integer("stock").default(0),
        // Campos extendidos (ver specs/003-libro-campos-extendidos): todos
        // opcionales, un libro cargado antes de este cambio los tiene en
        // NULL sin necesidad de backfill.
        alto: real("alto"),
        ancho: real("ancho"),
        largo: real("largo"),
        paginas: integer("paginas"),
        brief: text("brief"),
        edad_recomendada: integer("edad_recomendada"),
        book_trailer_url: varchar("book_trailer_url", { length: 500 }),
        // Key de storage (ver src/lib/storage), no la URL pública: la URL se
        // arma en el service con `storage.getUrl(portada_key)`, igual que
        // `operacion.service.ts` con los comprobantes.
        portada_key: text("portada_key"),
        // Colección a la que pertenece el libro: a lo sumo una (`null` =
        // ninguna). Es opcional, así que un libro cargado antes de este
        // cambio queda sin colección sin necesidad de backfill. El service
        // valida que la colección exista y sea del mismo usuario antes de
        // asignarla (ver libro.service.ts).
        coleccion_id: integer("coleccion_id").references(() => coleccionesTable.id),
        // Límite de stock negativo permitido al vender desde el depósito
        // principal (ver specs/016-tienda-ecommerce): 0 = no permitir vender
        // de más. No afecta el stock consignado en depósitos de clientes.
        stock_negativo_permitido: integer("stock_negativo_permitido").notNull().default(0),
        // Peso opcional del libro en kg (resolución de gramos), usado para
        // cotizar envíos. Si falta, se usa el promedio de la cuenta.
        peso_kg: real("peso_kg"),
        // bradb (ServiceBuilder) detecta soft-delete por la columna `deleted_at`.
        deletedAt: timestamp("deleted_at"),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id)
    },
    (table) => [
        // PK compuesta (id_libro, user): bradb arma el WHERE de
        // findOne/update/delete a partir de todas las columnas de la PK, así
        // que esto hace que no se pueda traer/editar/borrar un libro de otro
        // usuario ni por error.
        primaryKey({ columns: [table.id_libro, table.user] }),
        // isbn como valor único por usuario, sólo entre libros activos: un
        // isbn eliminado puede reutilizarse (ver spec, "Casos borde").
        uniqueIndex("libros_isbn_user_active_idx")
            .on(table.isbn, table.user)
            .where(sql`deleted_at IS NULL`),
        check("libros_stock_negativo_permitido_no_negativo", sql`${table.stock_negativo_permitido} >= 0`),
        check("libros_peso_kg_positivo", sql`${table.peso_kg} is null or ${table.peso_kg} > 0`)
    ]
);
