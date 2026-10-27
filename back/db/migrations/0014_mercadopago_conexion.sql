CREATE TYPE "public"."mercadopago_estado" AS ENUM('conectado', 'desconectado');--> statement-breakpoint
CREATE TABLE "mercadopago_conexiones" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "mercadopago_conexiones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"mp_user_id" varchar(64) NOT NULL,
	"alias" varchar(120),
	"email" varchar(255),
	"aplicacion_id" varchar(64),
	"access_token_cifrado" text NOT NULL,
	"refresh_token_cifrado" text,
	"vencimiento" timestamp,
	"estado" "mercadopago_estado" DEFAULT 'conectado' NOT NULL,
	"conectado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mercadopago_conexiones_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "mercadopago_conexiones" ADD CONSTRAINT "mercadopago_conexiones_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mercadopago_conexiones_user_idx" ON "mercadopago_conexiones" USING btree ("user");--> statement-breakpoint
CREATE UNIQUE INDEX "mercadopago_conexiones_mp_user_conectado_idx" ON "mercadopago_conexiones" USING btree ("mp_user_id") WHERE "mercadopago_conexiones"."estado" = 'conectado';