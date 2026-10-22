CREATE TABLE "liquidacion_lineas" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "liquidacion_lineas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"liquidacion_persona_id" integer NOT NULL,
	"id_libro" integer NOT NULL,
	"titulo" varchar(60) NOT NULL,
	"id_rol" integer NOT NULL,
	"rol_nombre" varchar(60) NOT NULL,
	"porcentaje" real NOT NULL,
	"importe" real NOT NULL,
	"user" integer NOT NULL,
	CONSTRAINT "liquidacion_lineas_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "liquidacion_lineas_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "liquidacion_pagos" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "liquidacion_pagos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"liquidacion_id" integer NOT NULL,
	"id_persona" integer NOT NULL,
	"monto" real NOT NULL,
	"fecha" date NOT NULL,
	"nota" text,
	"anulado" boolean DEFAULT false NOT NULL,
	"user" integer NOT NULL,
	CONSTRAINT "liquidacion_pagos_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "liquidacion_pagos_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "liquidacion_personas" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "liquidacion_personas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"liquidacion_id" integer NOT NULL,
	"id_persona" integer NOT NULL,
	"nombre" varchar(60) NOT NULL,
	"total" real NOT NULL,
	"user" integer NOT NULL,
	CONSTRAINT "liquidacion_personas_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "liquidacion_personas_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "liquidacion_ventas" (
	"movimiento_id" integer NOT NULL,
	"liquidacion_id" integer NOT NULL,
	"user" integer NOT NULL,
	CONSTRAINT "liquidacion_ventas_movimiento_id_user_pk" PRIMARY KEY("movimiento_id","user")
);
--> statement-breakpoint
CREATE TABLE "liquidaciones" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "liquidaciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" varchar(20) NOT NULL,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"fecha_generacion" timestamp DEFAULT now() NOT NULL,
	"user" integer NOT NULL,
	CONSTRAINT "liquidaciones_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "liquidaciones_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "anticipos" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "anticipos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_libro" integer NOT NULL,
	"id_persona" integer NOT NULL,
	"id_rol" integer NOT NULL,
	"monto" real NOT NULL,
	"fecha_lanzamiento" date NOT NULL,
	"pagado" boolean DEFAULT false NOT NULL,
	"fecha_pago" date,
	"user" integer NOT NULL,
	CONSTRAINT "anticipos_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "anticipos_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "libros_personas" ADD COLUMN "monto_acordado" real;--> statement-breakpoint
ALTER TABLE "liquidacion_lineas" ADD CONSTRAINT "liquidacion_lineas_liquidacion_persona_id_user_liquidacion_personas_id_user_fk" FOREIGN KEY ("liquidacion_persona_id","user") REFERENCES "public"."liquidacion_personas"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion_pagos" ADD CONSTRAINT "liquidacion_pagos_liquidacion_id_user_liquidaciones_id_user_fk" FOREIGN KEY ("liquidacion_id","user") REFERENCES "public"."liquidaciones"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion_personas" ADD CONSTRAINT "liquidacion_personas_id_persona_personas_id_fk" FOREIGN KEY ("id_persona") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion_personas" ADD CONSTRAINT "liquidacion_personas_liquidacion_id_user_liquidaciones_id_user_fk" FOREIGN KEY ("liquidacion_id","user") REFERENCES "public"."liquidaciones"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion_ventas" ADD CONSTRAINT "liquidacion_ventas_movimiento_id_user_movimientos_id_user_fk" FOREIGN KEY ("movimiento_id","user") REFERENCES "public"."movimientos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion_ventas" ADD CONSTRAINT "liquidacion_ventas_liquidacion_id_user_liquidaciones_id_user_fk" FOREIGN KEY ("liquidacion_id","user") REFERENCES "public"."liquidaciones"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_id_libro_libros_id_libro_fk" FOREIGN KEY ("id_libro") REFERENCES "public"."libros"("id_libro") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_id_persona_personas_id_fk" FOREIGN KEY ("id_persona") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_id_rol_roles_id_fk" FOREIGN KEY ("id_rol") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "liquidacion_personas_unica_idx" ON "liquidacion_personas" USING btree ("liquidacion_id","id_persona","user");--> statement-breakpoint
CREATE UNIQUE INDEX "liquidaciones_codigo_por_usuario_idx" ON "liquidaciones" USING btree ("user","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "anticipos_libro_persona_rol_idx" ON "anticipos" USING btree ("id_libro","id_persona","id_rol","user");