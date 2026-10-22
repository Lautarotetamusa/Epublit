CREATE TABLE IF NOT EXISTS "roles" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(60) NOT NULL,
	"user" integer NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "roles_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "roles_id_unique" UNIQUE("id")
);
--> statement-breakpoint
-- `id_rol` arranca nullable para poder backfillearla; recién después del
-- datos se marca NOT NULL (una relación libro↔persona ya no puede quedar sin
-- rol). Ver specs/011-roles, tareas 2 y 3.
ALTER TABLE "libros_personas" ADD COLUMN IF NOT EXISTS "id_rol" integer;--> statement-breakpoint
-- Migración de datos: crea los roles por defecto (autor, ilustrador) de cada
-- cuenta existente y liga cada relación libro↔persona al rol de su cuenta con
-- el mismo nombre que tenía el valor fijo anterior. Idempotente: se puede
-- correr más de una vez sin duplicar roles ni pisar relaciones ya migradas; el
-- backfill se salta si la columna `tipo` ya no existe.
DO $$
BEGIN
    INSERT INTO "roles" ("nombre", "user")
    SELECT r."nombre", u."id"
    FROM "users" u
    CROSS JOIN (VALUES ('autor'), ('ilustrador')) AS r("nombre")
    WHERE NOT EXISTS (
        SELECT 1 FROM "roles" rol
        WHERE rol."user" = u."id" AND rol."nombre" = r."nombre" AND rol."deleted_at" IS NULL
    );

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'libros_personas' AND column_name = 'tipo'
    ) THEN
        UPDATE "libros_personas" lp
        SET "id_rol" = rol."id"
        FROM "libros" l, "roles" rol
        WHERE l."id_libro" = lp."id_libro"
          AND rol."user" = l."user"
          AND rol."nombre" = lp."tipo"::text
          AND rol."deleted_at" IS NULL
          AND lp."id_rol" IS NULL;
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "libros_personas" ALTER COLUMN "id_rol" SET NOT NULL;--> statement-breakpoint
-- La PK pasa a incluir el rol en lugar del valor fijo: la misma persona puede
-- tener roles distintos en el mismo libro, pero no repetir el mismo.
ALTER TABLE "libros_personas" DROP CONSTRAINT IF EXISTS "libros_personas_id_libro_id_persona_tipo_pk";--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'libros_personas_id_libro_id_persona_id_rol_pk') THEN
        ALTER TABLE "libros_personas" ADD CONSTRAINT "libros_personas_id_libro_id_persona_id_rol_pk" PRIMARY KEY("id_libro","id_persona","id_rol");
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_user_users_id_fk') THEN
        ALTER TABLE "roles" ADD CONSTRAINT "roles_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'libros_personas_id_rol_roles_id_fk') THEN
        ALTER TABLE "libros_personas" ADD CONSTRAINT "libros_personas_id_rol_roles_id_fk" FOREIGN KEY ("id_rol") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_nombre_por_usuario_idx" ON "roles" USING btree ("user",lower("nombre")) WHERE "roles"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "libros_personas" DROP COLUMN IF EXISTS "tipo";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."libro_persona_tipo";
