ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "id_cliente" integer;--> statement-breakpoint
-- Migración de datos: el cliente de las ventas (`venta`/`ventaConsignacion`)
-- pasa de `movimientos.id_cliente` a `ventas.id_cliente`. Guardado para poder
-- correr la migración más de una vez (después del primer pase la columna ya no
-- existe en `movimientos`).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'movimientos' AND column_name = 'id_cliente'
    ) THEN
        UPDATE "ventas" v
        SET "id_cliente" = m."id_cliente"
        FROM "movimientos" m
        WHERE m."id" = v."id_movimiento" AND v."id_cliente" IS NULL;
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "ventas" ALTER COLUMN "id_cliente" SET NOT NULL;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ventas_id_cliente_clientes_id_fk'
    ) THEN
        ALTER TABLE "ventas" ADD CONSTRAINT "ventas_id_cliente_clientes_id_fk" FOREIGN KEY ("id_cliente") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "movimientos" DROP CONSTRAINT IF EXISTS "movimientos_id_cliente_user_clientes_id_user_fk";--> statement-breakpoint
ALTER TABLE "movimientos" DROP COLUMN IF EXISTS "id_cliente";
