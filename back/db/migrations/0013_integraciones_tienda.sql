CREATE TABLE "integraciones" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "integraciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"origen" varchar(255) NOT NULL,
	"prefijo" varchar(16) NOT NULL,
	"clave_hash" varchar(64) NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"revocada" boolean DEFAULT false NOT NULL,
	"ultimo_uso" timestamp,
	"creada_en" timestamp DEFAULT now() NOT NULL,
	"actualizada_en" timestamp DEFAULT now() NOT NULL,
	"revocada_en" timestamp,
	CONSTRAINT "integraciones_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "integraciones_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "integraciones" ADD CONSTRAINT "integraciones_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integraciones_clave_hash_idx" ON "integraciones" USING btree ("clave_hash");--> statement-breakpoint
CREATE INDEX "integraciones_user_prefijo_idx" ON "integraciones" USING btree ("user","prefijo");--> statement-breakpoint
CREATE INDEX "integraciones_user_idx" ON "integraciones" USING btree ("user");