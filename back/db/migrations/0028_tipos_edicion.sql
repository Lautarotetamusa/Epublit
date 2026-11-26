CREATE TABLE "tipos_edicion" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "tipos_edicion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(60) NOT NULL,
	"user" integer NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "tipos_edicion_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "tipos_edicion_id_unique" UNIQUE("id")
);
--> statement-breakpoint
-- `tipo_edicion_id` arranca nullable para poder backfillearla; recién después
-- de los datos se marca NOT NULL (un libro ya no puede quedar sin tipo).
-- Reemplaza al enum fijo `libro_tipo_edicion`, ver módulo TipoEdición.
ALTER TABLE "libros" ADD COLUMN IF NOT EXISTS "tipo_edicion_id" integer;--> statement-breakpoint
-- Migración de datos: crea los tipos por defecto de cada cuenta existente
-- ("Normal", "Pop up", "Cartoné") y liga cada libro al tipo de su cuenta con
-- el mismo nombre que tenía el valor fijo anterior. Idempotente: se puede
-- correr más de una vez sin duplicar tipos ni pisar libros ya migrados; el
-- backfill se salta si la columna `tipo_edicion` ya no existe.
DO $$
BEGIN
    INSERT INTO "tipos_edicion" ("nombre", "user")
    SELECT t."nombre", u."id"
    FROM "users" u
    CROSS JOIN (VALUES ('Normal'), ('Pop up'), ('Cartoné')) AS t("nombre")
    WHERE NOT EXISTS (
        SELECT 1 FROM "tipos_edicion" te
        WHERE te."user" = u."id" AND lower(te."nombre") = lower(t."nombre") AND te."deleted_at" IS NULL
    );

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'libros' AND column_name = 'tipo_edicion'
    ) THEN
        UPDATE "libros" l
        SET "tipo_edicion_id" = te."id"
        FROM "tipos_edicion" te
        WHERE te."user" = l."user"
          AND te."deleted_at" IS NULL
          AND te."nombre" = CASE l."tipo_edicion"::text
              WHEN 'pop_up' THEN 'Pop up'
              WHEN 'cartone' THEN 'Cartoné'
              ELSE 'Normal'
          END
          AND l."tipo_edicion_id" IS NULL;
    END IF;

    -- Cualquier libro que no haya matcheado (o que exista sin la columna
    -- vieja por una corrida parcial) queda con el "Normal" de su cuenta.
    UPDATE "libros" l
    SET "tipo_edicion_id" = te."id"
    FROM "tipos_edicion" te
    WHERE te."user" = l."user"
      AND te."deleted_at" IS NULL
      AND lower(te."nombre") = 'normal'
      AND l."tipo_edicion_id" IS NULL;
END $$;--> statement-breakpoint
ALTER TABLE "libros" ALTER COLUMN "tipo_edicion_id" SET NOT NULL;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tipos_edicion_user_users_id_fk') THEN
        ALTER TABLE "tipos_edicion" ADD CONSTRAINT "tipos_edicion_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'libros_tipo_edicion_id_tipos_edicion_id_fk') THEN
        ALTER TABLE "libros" ADD CONSTRAINT "libros_tipo_edicion_id_tipos_edicion_id_fk" FOREIGN KEY ("tipo_edicion_id") REFERENCES "public"."tipos_edicion"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_edicion_nombre_por_usuario_idx" ON "tipos_edicion" USING btree ("user",lower("nombre")) WHERE "tipos_edicion"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "libros" DROP COLUMN IF EXISTS "tipo_edicion";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."libro_tipo_edicion";
