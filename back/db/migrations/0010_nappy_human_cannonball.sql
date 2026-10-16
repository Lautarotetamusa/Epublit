ALTER TABLE "movimientos" ADD COLUMN "es_migracion" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill (ver specs/014-metricas-ventas): marca como `es_migracion` los
-- ingresos que reconstruyó la migración 0004 al trasladar el stock preexistente
-- al depósito principal. No son un lanzamiento ni una reimpresión.
--
-- Cómo se identifican sin un flag previo: la 0004 insertó, por cada libro con
-- stock global > 0, un ingreso (exterior → depósito principal) con una sola
-- línea y `cantidad` igual a ese stock. `libros.stock` quedó congelado desde
-- entonces (el stock real vive en `deposito_libros` y la app ya no escribe esa
-- columna), así que la firma `cantidad = libros.stock > 0` + línea única + sin
-- archivo sólo la cumplen esos ingresos de la migración. Idempotente: repetirla
-- no cambia nada.
UPDATE "movimientos" m
SET "es_migracion" = true
FROM "movimientos_libros" ml
JOIN "libros" l
    ON l."id_libro" = ml."id_libro" AND l."user" = ml."user"
WHERE ml."movimiento_id" = m."id"
    AND ml."user" = m."user"
    AND m."tipo" = 'ingreso'
    AND m."origen_tipo" = 'exterior'
    AND m."file_path" IS NULL
    AND l."stock" > 0
    AND ml."cantidad" = l."stock"
    AND (
        SELECT count(*) FROM "movimientos_libros" otra
        WHERE otra."movimiento_id" = m."id" AND otra."user" = m."user"
    ) = 1;