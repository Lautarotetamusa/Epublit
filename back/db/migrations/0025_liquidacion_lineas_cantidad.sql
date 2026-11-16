ALTER TABLE "liquidacion_lineas" ADD COLUMN "cantidad" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill: las líneas ya generadas toman los ejemplares de su libro vendidos en
-- las ventas que cubrió su liquidación (ver specs/023-liquidacion-reporte-por-autor).
UPDATE "liquidacion_lineas" AS "linea"
SET "cantidad" = "vendidos"."cantidad"
FROM (
	SELECT "persona"."id" AS "liquidacion_persona_id", "ml"."id_libro", SUM("ml"."cantidad")::integer AS "cantidad"
	FROM "liquidacion_personas" AS "persona"
	INNER JOIN "liquidacion_ventas" AS "lv"
		ON "lv"."liquidacion_id" = "persona"."liquidacion_id" AND "lv"."user" = "persona"."user"
	INNER JOIN "movimientos_libros" AS "ml"
		ON "ml"."movimiento_id" = "lv"."movimiento_id" AND "ml"."user" = "lv"."user"
	GROUP BY "persona"."id", "ml"."id_libro"
) AS "vendidos"
WHERE "linea"."liquidacion_persona_id" = "vendidos"."liquidacion_persona_id"
	AND "linea"."id_libro" = "vendidos"."id_libro";
