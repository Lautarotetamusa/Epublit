CREATE TABLE "envio_config" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "envio_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"micorreo_usuario" varchar(120),
	"micorreo_credencial_cifrada" text,
	"peso_promedio_kg" real,
	"origen_calle" varchar(120),
	"origen_numero" varchar(20),
	"origen_piso" varchar(20),
	"origen_localidad" varchar(120),
	"origen_provincia" varchar(120),
	"origen_codigo_postal" varchar(12),
	"retiro_activo" boolean DEFAULT false NOT NULL,
	"retiro_direccion" text,
	"retiro_horario" text,
	"creada_en" timestamp DEFAULT now() NOT NULL,
	"actualizada_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "envio_config_id_unique" UNIQUE("id"),
	CONSTRAINT "envio_config_peso_promedio_positivo" CHECK ("envio_config"."peso_promedio_kg" is null or "envio_config"."peso_promedio_kg" > 0)
);
--> statement-breakpoint
ALTER TABLE "envio_config" ADD CONSTRAINT "envio_config_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "envio_config_user_idx" ON "envio_config" USING btree ("user");