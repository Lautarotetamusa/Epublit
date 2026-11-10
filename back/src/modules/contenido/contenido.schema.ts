import {
    boolean,
    check,
    foreignKey,
    index,
    integer,
    jsonb,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    varchar
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "../user/user.schema";

// Contenido del CMS de la landing (ver specs/020-cms-landing). Tres entidades
// acotadas por cuenta: una imagen guarda el archivo y sus dimensiones; una
// página referencia su portada y guarda los textos de esa colocación; cada
// bloque referencia imágenes desde su propio JSON, porque el alt/epígrafe se
// guardan por colocación y no por archivo.

export type ContenidoBloqueJson = Record<string, unknown>;

export const contenidoImagenesTable = pgTable(
    "contenido_imagenes",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        storage_key: text("storage_key").notNull(),
        mime: varchar("mime", { length: 32 }).notNull(),
        bytes: integer("bytes").notNull(),
        ancho: integer("ancho").notNull(),
        alto: integer("alto").notNull(),
        creada_en: timestamp("creada_en").notNull().defaultNow()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        // La key es única global: identifica el archivo físico y permite
        // reconstruir la URL sin ambigüedad.
        uniqueIndex("contenido_imagenes_storage_key_idx").on(table.storage_key),
        index("contenido_imagenes_user_idx").on(table.user),
        check("contenido_imagenes_bytes_no_negativos", sql`${table.bytes} >= 0`),
        check("contenido_imagenes_ancho_positivo", sql`${table.ancho} > 0`),
        check("contenido_imagenes_alto_positivo", sql`${table.alto} > 0`)
    ]
);

export const contenidoPaginasTable = pgTable(
    "contenido_paginas",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        titulo: varchar("titulo", { length: 200 }).notNull().default(""),
        slug: varchar("slug", { length: 80 }),
        descripcion: varchar("descripcion", { length: 320 }),
        portada_imagen_id: integer("portada_imagen_id"),
        portada_texto_alternativo: varchar("portada_texto_alternativo", { length: 300 }),
        portada_epigrafe: varchar("portada_epigrafe", { length: 300 }),
        visible_en_menu: boolean("visible_en_menu").notNull().default(false),
        orden: integer("orden").notNull().default(0),
        estado: varchar("estado", { length: 20 }).notNull().default("borrador"),
        creada_en: timestamp("creada_en").notNull().defaultNow(),
        actualizada_en: timestamp("actualizada_en").notNull().defaultNow(),
        // La sesión identifica la cuenta por id; la respuesta necesita el
        // username, que se resuelve con un join al leer.
        actualizada_por: integer("actualizada_por")
            .notNull()
            .references(() => usersTable.id),
        deleted_at: timestamp("deleted_at")
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        // La portada incluye la cuenta en el FK compuesto: una página no
        // puede apuntar a una imagen de otra cuenta ni por error de datos.
        foreignKey({
            columns: [table.portada_imagen_id, table.user],
            foreignColumns: [contenidoImagenesTable.id, contenidoImagenesTable.user],
            name: "contenido_paginas_portada_imagen_fk"
        }),
        // El slug es único sólo entre páginas vigentes; una dada de baja deja
        // de competir y varias páginas sin slug conviven sin problema.
        uniqueIndex("contenido_paginas_user_slug_vigente_idx")
            .on(table.user, table.slug)
            .where(sql`${table.deleted_at} is null and ${table.slug} is not null`),
        index("contenido_paginas_user_orden_idx").on(table.user, table.orden),
        check("contenido_paginas_estado_valido", sql`${table.estado} in ('borrador', 'publicada')`),
        check("contenido_paginas_orden_no_negativo", sql`${table.orden} >= 0`)
    ]
);

export const contenidoBloquesTable = pgTable(
    "contenido_bloques",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        pagina_id: integer("pagina_id").notNull(),
        tipo: varchar("tipo", { length: 20 }).notNull(),
        posicion: integer("posicion").notNull(),
        contenido: jsonb("contenido").$type<ContenidoBloqueJson>().notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.pagina_id, table.user],
            foreignColumns: [contenidoPaginasTable.id, contenidoPaginasTable.user],
            name: "contenido_bloques_pagina_fk"
        }),
        // La secuencia guardada no puede repetir posiciones. Los huecos los
        // evita el guardado completo del array (el service renumera 0..n-1).
        uniqueIndex("contenido_bloques_pagina_posicion_idx").on(table.pagina_id, table.posicion),
        index("contenido_bloques_user_idx").on(table.user),
        check("contenido_bloques_posicion_no_negativa", sql`${table.posicion} >= 0`),
        check(
            "contenido_bloques_tipo_valido",
            sql`${table.tipo} in ('hero', 'texto', 'imagen_texto', 'galeria', 'cita', 'datos', 'enlaces')`
        )
    ]
);
