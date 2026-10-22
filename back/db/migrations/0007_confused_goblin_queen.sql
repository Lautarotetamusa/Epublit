CREATE TABLE IF NOT EXISTS "medios_pago" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "medios_pago_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(60) NOT NULL,
	"comision" real DEFAULT 0 NOT NULL,
	"user" integer NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "medios_pago_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "medios_pago_id_unique" UNIQUE("id")
);
--> statement-breakpoint
-- `id_medio_pago` arranca nullable para poder backfillearla; recién después del
-- datos se marca NOT NULL (una venta histórica ya no puede quedar sin medio).
ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "id_medio_pago" integer;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "comision" real DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Migración de datos (ver specs/010-medios-pago, tareas 2 y 3): crea los 5
-- medios por defecto de cada cuenta existente, liga cada venta histórica al
-- medio de su cuenta por nombre y guarda la comisión vigente (0%). Idempotente:
-- se puede correr más de una vez sin duplicar medios ni pisar ventas ya
-- migradas; el backfill se salta si la columna `medio_pago` ya no existe.
DO $$
BEGIN
    INSERT INTO "medios_pago" ("nombre", "comision", "user")
    SELECT m."nombre", 0, u."id"
    FROM "users" u
    CROSS JOIN (VALUES ('efectivo'), ('debito'), ('credito'), ('mercadopago'), ('transferencia')) AS m("nombre")
    WHERE NOT EXISTS (
        SELECT 1 FROM "medios_pago" mp
        WHERE mp."user" = u."id" AND mp."nombre" = m."nombre" AND mp."deleted_at" IS NULL
    );

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ventas' AND column_name = 'medio_pago'
    ) THEN
        UPDATE "ventas" v
        SET "id_medio_pago" = mp."id", "comision" = 0
        FROM "movimientos" m, "medios_pago" mp
        WHERE m."id" = v."id_movimiento"
          AND mp."user" = m."user"
          AND mp."nombre" = v."medio_pago"::text
          AND mp."deleted_at" IS NULL
          AND v."id_medio_pago" IS NULL;

        -- Ventas sin medio cargado (la columna era nullable): se les asigna el
        -- "efectivo" por defecto de la cuenta para poder dejar la FK NOT NULL.
        UPDATE "ventas" v
        SET "id_medio_pago" = mp."id", "comision" = 0
        FROM "movimientos" m, "medios_pago" mp
        WHERE m."id" = v."id_movimiento"
          AND mp."user" = m."user"
          AND mp."nombre" = 'efectivo'
          AND mp."deleted_at" IS NULL
          AND v."id_medio_pago" IS NULL;
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "ventas" ALTER COLUMN "id_medio_pago" SET NOT NULL;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medios_pago_user_users_id_fk') THEN
        ALTER TABLE "medios_pago" ADD CONSTRAINT "medios_pago_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ventas_id_medio_pago_medios_pago_id_fk') THEN
        ALTER TABLE "ventas" ADD CONSTRAINT "ventas_id_medio_pago_medios_pago_id_fk" FOREIGN KEY ("id_medio_pago") REFERENCES "public"."medios_pago"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "medios_pago_nombre_por_usuario_idx" ON "medios_pago" USING btree ("user","nombre") WHERE "medios_pago"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "ventas" DROP COLUMN IF EXISTS "medio_pago";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."medio_pago";
