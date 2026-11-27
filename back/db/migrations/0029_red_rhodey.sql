-- Panel de administración cross-tenant (ver specs/028-panel-admin-metricas).
-- El rol arranca con `editorial` para todas las cuentas existentes: asignar el
-- primer administrador es una decisión manual, no un efecto de la migración.
DO $$
BEGIN
    IF to_regtype('public.user_role') IS NULL THEN
        CREATE TYPE "public"."user_role" AS ENUM('editorial', 'admin');
    END IF;
END $$;--> statement-breakpoint
-- `created_at` se agrega sin default para que las filas existentes queden en
-- NULL: la fecha se completa después con evidencia real, nunca con la fecha de
-- la migración. El default se activa al final para las altas nuevas.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" DEFAULT 'editorial' NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN IF NOT EXISTS "created_at" timestamp;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "created_at" timestamp;--> statement-breakpoint
ALTER TABLE "libros" ADD COLUMN IF NOT EXISTS "created_at" timestamp;--> statement-breakpoint
-- Backfill de alta de cuentas: primera evidencia disponible de cada cuenta,
-- sin usar la fecha de la migración. Los ingresos de stock reconstruidos por la
-- migración no son evidencia. Idempotente: sólo completa NULLs, no pisa altas
-- ya asignadas.
DO $$
BEGIN
    WITH evidencia AS (
        SELECT e."user", MIN(e."fecha") AS "fecha"
        FROM (
            SELECT "user", "creado_en" AS "fecha" FROM "tokens_cuenta"
            UNION ALL
            SELECT "user", "fecha" FROM "movimientos" WHERE "es_migracion" = false
            UNION ALL
            SELECT "user", "created_at" FROM "precio_libros"
            UNION ALL
            SELECT "user", "creado_en" FROM "pedidos"
            UNION ALL
            SELECT "user", "created_at" FROM "libro_resenas"
            UNION ALL
            SELECT "user", "creada_en" FROM "contenido_paginas"
            UNION ALL
            SELECT "user", "fecha_generacion" FROM "liquidaciones"
            UNION ALL
            SELECT "user", "creada_en" FROM "integraciones"
        ) e
        WHERE e."fecha" IS NOT NULL
        GROUP BY e."user"
    )
    UPDATE "users" u
    SET "created_at" = evidencia."fecha"
    FROM evidencia
    WHERE u."id" = evidencia."user" AND u."created_at" IS NULL;
END $$;--> statement-breakpoint
-- Backfill de alta de libros: el primer precio registrado. Los libros sin
-- historial de precios quedan sin fecha (no se inventa la de la migración).
UPDATE "libros" l
SET "created_at" = p."fecha"
FROM (
    SELECT "id_libro", MIN("created_at") AS "fecha"
    FROM "precio_libros"
    GROUP BY "id_libro"
) p
WHERE l."id_libro" = p."id_libro" AND l."created_at" IS NULL;--> statement-breakpoint
-- Recién ahora el default, para que las altas nuevas se fechen al crearse.
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "personas" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "libros" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
-- Índices que soportan los agregados y filtros del panel. No modifican filas.
CREATE INDEX IF NOT EXISTS "users_email_confirmado_created_at_idx" ON "users" USING btree ("email_confirmado","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_confirmado_production_idx" ON "users" USING btree ("email_confirmado","production");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "movimientos_user_fecha_idx" ON "movimientos" USING btree ("user","fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personas_user_created_at_idx" ON "personas" USING btree ("user","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clientes_user_created_at_idx" ON "clientes" USING btree ("user","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "libros_user_created_at_idx" ON "libros" USING btree ("user","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "libro_resenas_user_created_at_idx" ON "libro_resenas" USING btree ("user","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "precio_libros_user_created_at_idx" ON "precio_libros" USING btree ("user","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "precio_libros_libro_created_at_idx" ON "precio_libros" USING btree ("id_libro","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "liquidaciones_user_fecha_generacion_idx" ON "liquidaciones" USING btree ("user","fecha_generacion");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integraciones_user_creada_en_idx" ON "integraciones" USING btree ("user","creada_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contenido_paginas_user_actualizada_en_idx" ON "contenido_paginas" USING btree ("user","actualizada_en");
