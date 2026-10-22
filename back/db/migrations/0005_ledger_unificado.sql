CREATE TYPE "public"."extremo_tipo" AS ENUM('deposito', 'exterior');--> statement-breakpoint
CREATE TYPE "public"."movimiento_tipo" AS ENUM('ingreso', 'baja', 'transferencia', 'venta', 'consignacion', 'ventaConsignacion', 'devolucion');--> statement-breakpoint
ALTER TABLE "depositos" ADD COLUMN "id_cliente" integer;--> statement-breakpoint
ALTER TABLE "movimientos_libros" ADD COLUMN "precio" real;--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "tipo" "movimiento_tipo";--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "id_cliente" integer;--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "file_path" varchar(80);--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "id_movimiento" integer;--> statement-breakpoint
ALTER TABLE "ventas" DROP CONSTRAINT "ventas_id_transaccion_transacciones_id_fk";--> statement-breakpoint
ALTER TABLE "movimientos" ALTER COLUMN "origen_tipo" SET DATA TYPE "public"."extremo_tipo" USING "origen_tipo"::"public"."extremo_tipo";--> statement-breakpoint
ALTER TABLE "movimientos" ALTER COLUMN "destino_tipo" SET DATA TYPE "public"."extremo_tipo" USING "destino_tipo"::"public"."extremo_tipo";--> statement-breakpoint
-- Migración de datos (ver specs/009-ledger-unificado, tarea 12): reconstruye
-- el historial comercial como movimientos, crea el depósito propio de cada
-- cliente y traslada el stock consignado. Idempotente: se puede correr más de
-- una vez sin duplicar movimientos, líneas, depósitos ni cantidades.
DO $$
DECLARE
    fila RECORD;
    movimiento_id integer;
    principal_id integer;
    deposito_cliente_id integer;
BEGIN
    -- Movimientos preexistentes (manuales y los creados por la migración de
    -- 008): se completa su tipo a partir del par de extremos.
    UPDATE "movimientos"
    SET "tipo" = CASE
        WHEN "origen_tipo" = 'exterior' THEN 'ingreso'::"movimiento_tipo"
        WHEN "destino_tipo" = 'exterior' THEN 'baja'::"movimiento_tipo"
        ELSE 'transferencia'::"movimiento_tipo"
    END
    WHERE "tipo" IS NULL;

    -- Un depósito propio por cliente existente.
    INSERT INTO "depositos" ("nombre", "principal", "user", "id_cliente")
    SELECT c."nombre", false, c."user", c."id"
    FROM "clientes" c
    WHERE NOT EXISTS (
        SELECT 1 FROM "depositos" d WHERE d."id_cliente" = c."id"
    );

    -- Stock consignado vigente -> depósito del cliente, sin movimiento
    -- sintético (las consignaciones históricas reconstruidas ya representan
    -- ese camino). Se deja el registro viejo en 0 y se salta si la columna ya
    -- no existe, para poder correr el bloque más de una vez sin duplicar.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'libro_cliente' AND column_name = 'stock'
    ) THEN
        UPDATE "deposito_libros" dl
        SET "cantidad" = dl."cantidad" + lc."stock"
        FROM "libro_cliente" lc
        JOIN "depositos" d ON d."id_cliente" = lc."id_cliente"
        WHERE dl."deposito_id" = d."id" AND dl."id_libro" = lc."id_libro" AND lc."stock" <> 0;

        INSERT INTO "deposito_libros" ("deposito_id", "id_libro", "cantidad", "user")
        SELECT d."id", lc."id_libro", lc."stock", d."user"
        FROM "libro_cliente" lc
        JOIN "depositos" d ON d."id_cliente" = lc."id_cliente"
        WHERE lc."stock" <> 0
          AND NOT EXISTS (
              SELECT 1 FROM "deposito_libros" dl
              WHERE dl."deposito_id" = d."id" AND dl."id_libro" = lc."id_libro"
          );

        UPDATE "libro_cliente" SET "stock" = 0 WHERE "stock" <> 0;
    END IF;

    -- Cada transacción comercial cargada se reconstruye como un movimiento del
    -- tipo que representa, preservando fecha, cliente, libros, precio,
    -- archivo y extensión de venta. No aplica efecto de stock.
    IF to_regclass('public.transacciones') IS NOT NULL THEN
        FOR fila IN SELECT * FROM "transacciones" ORDER BY "id" LOOP
            SELECT d."id" INTO principal_id
            FROM "depositos" d
            WHERE d."user" = fila."user" AND d."principal" AND d."deleted_at" IS NULL
            LIMIT 1;

            IF fila."type" IN ('consignacion', 'ventaConsignacion', 'devolucion') THEN
                SELECT d."id" INTO deposito_cliente_id
                FROM "depositos" d
                WHERE d."id_cliente" = fila."id_cliente"
                LIMIT 1;
            END IF;

            INSERT INTO "movimientos" (
                "fecha", "tipo", "origen_tipo", "origen_deposito_id",
                "destino_tipo", "destino_deposito_id", "id_cliente", "file_path", "user"
            ) VALUES (
                fila."fecha",
                fila."type"::text::"movimiento_tipo",
                'deposito'::"extremo_tipo",
                CASE
                    WHEN fila."type" IN ('ventaConsignacion', 'devolucion') THEN deposito_cliente_id
                    ELSE principal_id
                END,
                CASE WHEN fila."type" IN ('venta', 'ventaConsignacion') THEN 'exterior' ELSE 'deposito' END::"extremo_tipo",
                CASE
                    WHEN fila."type" = 'consignacion' THEN deposito_cliente_id
                    WHEN fila."type" = 'devolucion' THEN principal_id
                    ELSE NULL
                END,
                fila."id_cliente",
                CASE
                    WHEN fila."file_path" = '' THEN NULL
                    WHEN fila."type" = 'consignacion' THEN 'remitos/' || fila."file_path"
                    ELSE 'facturas/' || fila."file_path"
                END,
                fila."user"
            )
            RETURNING "id" INTO movimiento_id;

            INSERT INTO "movimientos_libros" ("movimiento_id", "id_libro", "cantidad", "precio", "user")
            SELECT movimiento_id, lt."id_libro", lt."cantidad", lt."precio", fila."user"
            FROM "libros_transacciones" lt
            WHERE lt."id_transaccion" = fila."id";

            IF fila."type" IN ('venta', 'ventaConsignacion') THEN
                UPDATE "ventas" SET "id_movimiento" = movimiento_id WHERE "id_transaccion" = fila."id";
            END IF;
        END LOOP;

        -- Se vacían las tablas viejas para que un segundo pase del bloque no
        -- duplique movimientos (la migración las elimina a continuación).
        DELETE FROM "libros_transacciones";
        DELETE FROM "transacciones";
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "movimientos" ALTER COLUMN "tipo" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ventas" ALTER COLUMN "id_movimiento" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ventas" DROP CONSTRAINT "ventas_pkey";--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_pkey" PRIMARY KEY ("id_movimiento");--> statement-breakpoint
ALTER TABLE "ventas" DROP COLUMN "id_transaccion";--> statement-breakpoint
ALTER TABLE "libro_cliente" DROP COLUMN "stock";--> statement-breakpoint
DROP TABLE "libros_transacciones" CASCADE;--> statement-breakpoint
DROP TABLE "transacciones" CASCADE;--> statement-breakpoint
DROP TYPE "public"."transaccion_tipo";--> statement-breakpoint
ALTER TABLE "depositos" ADD CONSTRAINT "depositos_id_cliente_clientes_id_fk" FOREIGN KEY ("id_cliente") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_id_cliente_user_clientes_id_user_fk" FOREIGN KEY ("id_cliente","user") REFERENCES "public"."clientes"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_id_movimiento_movimientos_id_fk" FOREIGN KEY ("id_movimiento") REFERENCES "public"."movimientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "depositos_cliente_idx" ON "depositos" USING btree ("id_cliente") WHERE "depositos"."id_cliente" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "movimientos_libros" ADD CONSTRAINT "cantidad_positiva" CHECK ("movimientos_libros"."cantidad" > 0);--> statement-breakpoint
ALTER TABLE "movimientos_libros" ADD CONSTRAINT "precio_no_negativo" CHECK ("movimientos_libros"."precio" >= 0);
