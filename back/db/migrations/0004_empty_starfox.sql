CREATE TABLE "depositos" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "depositos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(60) NOT NULL,
	"descripcion" text,
	"principal" boolean DEFAULT false NOT NULL,
	"user" integer NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "depositos_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "depositos_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "deposito_libros" (
	"deposito_id" integer NOT NULL,
	"id_libro" integer NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	"user" integer NOT NULL,
	CONSTRAINT "deposito_libros_deposito_id_id_libro_pk" PRIMARY KEY("deposito_id","id_libro")
);
--> statement-breakpoint
CREATE TABLE "movimientos_libros" (
	"movimiento_id" integer NOT NULL,
	"id_libro" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"user" integer NOT NULL,
	CONSTRAINT "movimientos_libros_movimiento_id_id_libro_pk" PRIMARY KEY("movimiento_id","id_libro")
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "movimientos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fecha" timestamp DEFAULT now() NOT NULL,
	"origen_tipo" varchar(10) NOT NULL,
	"origen_deposito_id" integer,
	"destino_tipo" varchar(10) NOT NULL,
	"destino_deposito_id" integer,
	"user" integer NOT NULL,
	CONSTRAINT "movimientos_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "movimientos_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "depositos" ADD CONSTRAINT "depositos_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposito_libros" ADD CONSTRAINT "deposito_libros_deposito_id_user_depositos_id_user_fk" FOREIGN KEY ("deposito_id","user") REFERENCES "public"."depositos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposito_libros" ADD CONSTRAINT "deposito_libros_id_libro_user_libros_id_libro_user_fk" FOREIGN KEY ("id_libro","user") REFERENCES "public"."libros"("id_libro","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_libros" ADD CONSTRAINT "movimientos_libros_movimiento_id_user_movimientos_id_user_fk" FOREIGN KEY ("movimiento_id","user") REFERENCES "public"."movimientos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_libros" ADD CONSTRAINT "movimientos_libros_id_libro_user_libros_id_libro_user_fk" FOREIGN KEY ("id_libro","user") REFERENCES "public"."libros"("id_libro","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_origen_deposito_id_user_depositos_id_user_fk" FOREIGN KEY ("origen_deposito_id","user") REFERENCES "public"."depositos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_destino_deposito_id_user_depositos_id_user_fk" FOREIGN KEY ("destino_deposito_id","user") REFERENCES "public"."depositos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "depositos_principal_por_usuario_idx" ON "depositos" USING btree ("user") WHERE "depositos"."principal" AND "depositos"."deleted_at" IS NULL;--> statement-breakpoint
-- backfill: depósito principal y stock histórico (ver specs/008-movimientos-deposito, tarea 2).
-- Idempotente: se puede correr más de una vez sin duplicar depósito, movimiento ni cantidad.
DO $$
DECLARE
    fila RECORD;
    principal_id integer;
    movimiento_id integer;
BEGIN
    INSERT INTO "depositos" ("nombre", "principal", "user")
    SELECT 'Depósito principal', true, u."id"
    FROM "users" u
    WHERE NOT EXISTS (
        SELECT 1 FROM "depositos" d
        WHERE d."user" = u."id" AND d."principal" AND d."deleted_at" IS NULL
    );

    FOR fila IN
        SELECT l."id_libro", l."user", COALESCE(l."stock", 0) AS cantidad
        FROM "libros" l
        WHERE l."deleted_at" IS NULL AND COALESCE(l."stock", 0) > 0
    LOOP
        SELECT d."id" INTO principal_id
        FROM "depositos" d
        WHERE d."user" = fila."user" AND d."principal" AND d."deleted_at" IS NULL
        LIMIT 1;

        IF NOT EXISTS (
            SELECT 1 FROM "deposito_libros" dl
            WHERE dl."deposito_id" = principal_id AND dl."id_libro" = fila."id_libro"
        ) THEN
            INSERT INTO "deposito_libros" ("deposito_id", "id_libro", "cantidad", "user")
            VALUES (principal_id, fila."id_libro", fila.cantidad, fila."user");

            INSERT INTO "movimientos" ("origen_tipo", "destino_tipo", "destino_deposito_id", "user")
            VALUES ('exterior', 'deposito', principal_id, fila."user")
            RETURNING "id" INTO movimiento_id;

            INSERT INTO "movimientos_libros" ("movimiento_id", "id_libro", "cantidad", "user")
            VALUES (movimiento_id, fila."id_libro", fila.cantidad, fila."user");
        END IF;
    END LOOP;
END $$;