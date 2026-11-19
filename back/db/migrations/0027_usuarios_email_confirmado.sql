-- Los índices únicos de abajo fallarían con un error genérico de Postgres:
-- se corta antes, sin tocar nada, con un mensaje que dice qué resolver. Los
-- datos de producción se corrigen a mano antes de migrar (ver
-- specs/026-registro-email/design.md, "Datos de producción").
DO $$
BEGIN
	IF EXISTS (
		SELECT lower("email") FROM "users"
		WHERE "email" IS NOT NULL AND "email" <> ''
		GROUP BY lower("email") HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Hay emails duplicados en users (sin distinguir mayúsculas): resolvelos antes de aplicar esta migración';
	END IF;
	IF EXISTS (
		SELECT lower("username") FROM "users"
		GROUP BY lower("username") HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Hay usernames duplicados en users (sin distinguir mayúsculas): resolvelos antes de aplicar esta migración';
	END IF;
END $$;--> statement-breakpoint
CREATE TYPE "public"."tipo_token_cuenta" AS ENUM('confirmar_email', 'restablecer_contrasena');--> statement-breakpoint
CREATE TABLE "tokens_cuenta" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tokens_cuenta_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"tipo" "tipo_token_cuenta" NOT NULL,
	"hash" varchar(64) NOT NULL,
	"creado_en" timestamp with time zone NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"usado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_confirmado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Las cuentas existentes son todas anteriores a la confirmación por email.
UPDATE "users" SET "email_confirmado" = true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username_interno" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "confirmacion_enviada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tokens_cuenta" ADD CONSTRAINT "tokens_cuenta_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tokens_cuenta_hash_idx" ON "tokens_cuenta" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "tokens_cuenta_user_idx" ON "tokens_cuenta" USING btree ("user","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email")) WHERE "users"."email" IS NOT NULL AND "users"."email" <> '';