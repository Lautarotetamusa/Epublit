CREATE TYPE "public"."pago_estado" AS ENUM('pendiente', 'aprobado', 'rechazado', 'reembolsado');--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "pagos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"pedido_id" integer NOT NULL,
	"proveedor" varchar(30) DEFAULT 'mercadopago' NOT NULL,
	"pago_id" varchar(120),
	"preferencia_id" varchar(120),
	"estado" "pago_estado" DEFAULT 'pendiente' NOT NULL,
	"importe" real NOT NULL,
	"moneda" varchar(3) DEFAULT 'ARS' NOT NULL,
	"datos_reembolso" jsonb,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pagos_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "pagos_id_unique" UNIQUE("id"),
	CONSTRAINT "pagos_importe_no_negativo" CHECK ("pagos"."importe" >= 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_eventos" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "webhook_eventos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"proveedor" varchar(30) NOT NULL,
	"evento_id" varchar(200) NOT NULL,
	"tipo" varchar(80),
	"payload" jsonb,
	"user" integer,
	"procesado_en" timestamp,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_eventos_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "envio_eventos" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "envio_eventos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"envio_id" integer NOT NULL,
	"evento_proveedor_id" varchar(200) NOT NULL,
	"estado" varchar(80),
	"descripcion" text,
	"fecha_evento" timestamp,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "envio_eventos_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "envio_eventos_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "envios" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "envios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"pedido_id" integer NOT NULL,
	"proveedor" varchar(30) DEFAULT 'micorreo' NOT NULL,
	"proveedor_envio_id" varchar(120),
	"codigo_seguimiento" varchar(120),
	"estado" varchar(80),
	"ultima_actualizacion" timestamp,
	"url_seguimiento" text,
	"etiqueta_file_path" text,
	"etiqueta_url" text,
	"etiqueta_creada_en" timestamp,
	"despachado_en" timestamp,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "envios_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "envios_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedido_id_user_pedidos_id_user_fk" FOREIGN KEY ("pedido_id","user") REFERENCES "public"."pedidos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envio_eventos" ADD CONSTRAINT "envio_eventos_envio_id_user_envios_id_user_fk" FOREIGN KEY ("envio_id","user") REFERENCES "public"."envios"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envios" ADD CONSTRAINT "envios_pedido_id_user_pedidos_id_user_fk" FOREIGN KEY ("pedido_id","user") REFERENCES "public"."pedidos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pagos_pago_id_idx" ON "pagos" USING btree ("pago_id") WHERE "pagos"."pago_id" is not null;--> statement-breakpoint
CREATE INDEX "pagos_pedido_idx" ON "pagos" USING btree ("pedido_id","creado_en");--> statement-breakpoint
CREATE INDEX "pagos_preferencia_idx" ON "pagos" USING btree ("preferencia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_eventos_proveedor_evento_idx" ON "webhook_eventos" USING btree ("proveedor","evento_id");--> statement-breakpoint
CREATE INDEX "webhook_eventos_user_idx" ON "webhook_eventos" USING btree ("user");--> statement-breakpoint
CREATE UNIQUE INDEX "envio_eventos_proveedor_idx" ON "envio_eventos" USING btree ("envio_id","evento_proveedor_id");--> statement-breakpoint
CREATE INDEX "envio_eventos_envio_fecha_idx" ON "envio_eventos" USING btree ("envio_id","fecha_evento");--> statement-breakpoint
CREATE UNIQUE INDEX "envios_pedido_idx" ON "envios" USING btree ("pedido_id");--> statement-breakpoint
CREATE UNIQUE INDEX "envios_proveedor_envio_id_idx" ON "envios" USING btree ("proveedor_envio_id") WHERE "envios"."proveedor_envio_id" is not null;--> statement-breakpoint
CREATE INDEX "envios_codigo_idx" ON "envios" USING btree ("codigo_seguimiento");