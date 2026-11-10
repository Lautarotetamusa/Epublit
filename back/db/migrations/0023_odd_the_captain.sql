CREATE TABLE "contenido_bloques" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "contenido_bloques_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"pagina_id" integer NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"posicion" integer NOT NULL,
	"contenido" jsonb NOT NULL,
	CONSTRAINT "contenido_bloques_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "contenido_bloques_id_unique" UNIQUE("id"),
	CONSTRAINT "contenido_bloques_posicion_no_negativa" CHECK ("contenido_bloques"."posicion" >= 0),
	CONSTRAINT "contenido_bloques_tipo_valido" CHECK ("contenido_bloques"."tipo" in ('hero', 'texto', 'imagen_texto', 'galeria', 'cita', 'datos', 'enlaces'))
);
--> statement-breakpoint
CREATE TABLE "contenido_imagenes" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "contenido_imagenes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"storage_key" text NOT NULL,
	"mime" varchar(32) NOT NULL,
	"bytes" integer NOT NULL,
	"ancho" integer NOT NULL,
	"alto" integer NOT NULL,
	"creada_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contenido_imagenes_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "contenido_imagenes_id_unique" UNIQUE("id"),
	CONSTRAINT "contenido_imagenes_bytes_no_negativos" CHECK ("contenido_imagenes"."bytes" >= 0),
	CONSTRAINT "contenido_imagenes_ancho_positivo" CHECK ("contenido_imagenes"."ancho" > 0),
	CONSTRAINT "contenido_imagenes_alto_positivo" CHECK ("contenido_imagenes"."alto" > 0)
);
--> statement-breakpoint
CREATE TABLE "contenido_paginas" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "contenido_paginas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"titulo" varchar(200) DEFAULT '' NOT NULL,
	"slug" varchar(80),
	"descripcion" varchar(320),
	"portada_imagen_id" integer,
	"portada_texto_alternativo" varchar(300),
	"portada_epigrafe" varchar(300),
	"visible_en_menu" boolean DEFAULT false NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"estado" varchar(20) DEFAULT 'borrador' NOT NULL,
	"creada_en" timestamp DEFAULT now() NOT NULL,
	"actualizada_en" timestamp DEFAULT now() NOT NULL,
	"actualizada_por" integer NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "contenido_paginas_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "contenido_paginas_id_unique" UNIQUE("id"),
	CONSTRAINT "contenido_paginas_estado_valido" CHECK ("contenido_paginas"."estado" in ('borrador', 'publicada')),
	CONSTRAINT "contenido_paginas_orden_no_negativo" CHECK ("contenido_paginas"."orden" >= 0)
);
--> statement-breakpoint
ALTER TABLE "contenido_bloques" ADD CONSTRAINT "contenido_bloques_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenido_bloques" ADD CONSTRAINT "contenido_bloques_pagina_fk" FOREIGN KEY ("pagina_id","user") REFERENCES "public"."contenido_paginas"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenido_imagenes" ADD CONSTRAINT "contenido_imagenes_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenido_paginas" ADD CONSTRAINT "contenido_paginas_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenido_paginas" ADD CONSTRAINT "contenido_paginas_actualizada_por_users_id_fk" FOREIGN KEY ("actualizada_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenido_paginas" ADD CONSTRAINT "contenido_paginas_portada_imagen_fk" FOREIGN KEY ("portada_imagen_id","user") REFERENCES "public"."contenido_imagenes"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contenido_bloques_pagina_posicion_idx" ON "contenido_bloques" USING btree ("pagina_id","posicion");--> statement-breakpoint
CREATE INDEX "contenido_bloques_user_idx" ON "contenido_bloques" USING btree ("user");--> statement-breakpoint
CREATE UNIQUE INDEX "contenido_imagenes_storage_key_idx" ON "contenido_imagenes" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "contenido_imagenes_user_idx" ON "contenido_imagenes" USING btree ("user");--> statement-breakpoint
CREATE UNIQUE INDEX "contenido_paginas_user_slug_vigente_idx" ON "contenido_paginas" USING btree ("user","slug") WHERE "contenido_paginas"."deleted_at" is null and "contenido_paginas"."slug" is not null;--> statement-breakpoint
CREATE INDEX "contenido_paginas_user_orden_idx" ON "contenido_paginas" USING btree ("user","orden");