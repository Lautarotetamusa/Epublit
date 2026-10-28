CREATE TYPE "public"."comprobante_estado" AS ENUM('pendiente', 'emitida', 'error');--> statement-breakpoint
CREATE TYPE "public"."comprobante_tipo" AS ENUM('factura_a', 'factura_b', 'factura_c', 'factura_m', 'remito');--> statement-breakpoint
CREATE TYPE "public"."factura_resultado" AS ENUM('A', 'R');--> statement-breakpoint
CREATE TABLE "comprobantes" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "comprobantes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"tipo" "comprobante_tipo" NOT NULL,
	"movimiento_id" integer NOT NULL,
	"punto_venta" integer NOT NULL,
	"numero" integer,
	"fecha" date,
	"estado" "comprobante_estado" DEFAULT 'pendiente' NOT NULL,
	"moneda" varchar(3) DEFAULT 'ARS' NOT NULL,
	"importe_subtotal" numeric(14, 2) DEFAULT 0 NOT NULL,
	"importe_total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"emisor" jsonb NOT NULL,
	"receptor" jsonb NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"plantilla_version" integer DEFAULT 1 NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comprobantes_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "comprobantes_id_unique" UNIQUE("id"),
	CONSTRAINT "comprobantes_importe_subtotal_no_negativo" CHECK ("comprobantes"."importe_subtotal" >= 0),
	CONSTRAINT "comprobantes_importe_total_no_negativo" CHECK ("comprobantes"."importe_total" >= 0),
	CONSTRAINT "comprobantes_punto_venta_positivo" CHECK ("comprobantes"."punto_venta" > 0),
	CONSTRAINT "comprobantes_numero_positivo" CHECK ("comprobantes"."numero" is null or "comprobantes"."numero" > 0),
	CONSTRAINT "comprobantes_emitida_con_numero" CHECK ("comprobantes"."estado" <> 'emitida' or "comprobantes"."numero" is not null)
);
--> statement-breakpoint
CREATE TABLE "facturas" (
	"comprobante_id" integer PRIMARY KEY NOT NULL,
	"codigo_afip" integer NOT NULL,
	"cae" varchar(20),
	"cae_vencimiento" date,
	"resultado" "factura_resultado",
	"observaciones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"datos_afip" jsonb,
	"qr_url" text,
	"numero_esperado" integer,
	"importe_envio" numeric(14, 2) DEFAULT 0 NOT NULL,
	"importe_descuento" numeric(14, 2) DEFAULT 0 NOT NULL,
	"importe_neto" numeric(14, 2) DEFAULT 0 NOT NULL,
	"importe_iva" numeric(14, 2) DEFAULT 0 NOT NULL,
	"importe_exento" numeric(14, 2) DEFAULT 0 NOT NULL,
	"importe_no_gravado" numeric(14, 2) DEFAULT 0 NOT NULL,
	"importe_tributos" numeric(14, 2) DEFAULT 0 NOT NULL,
	"descuento_porcentaje" numeric(5, 2) DEFAULT 0 NOT NULL,
	"error_codigo" varchar(40),
	"error_mensaje" text,
	"intentos" integer DEFAULT 0 NOT NULL,
	"procesando_desde" timestamp,
	"ultimo_intento_en" timestamp,
	"emitido_en" timestamp,
	CONSTRAINT "facturas_codigo_afip_valido" CHECK ("facturas"."codigo_afip" in (1, 6, 11, 51)),
	CONSTRAINT "facturas_importe_envio_no_negativo" CHECK ("facturas"."importe_envio" >= 0),
	CONSTRAINT "facturas_importe_descuento_no_negativo" CHECK ("facturas"."importe_descuento" >= 0),
	CONSTRAINT "facturas_importe_neto_no_negativo" CHECK ("facturas"."importe_neto" >= 0),
	CONSTRAINT "facturas_importe_iva_no_negativo" CHECK ("facturas"."importe_iva" >= 0),
	CONSTRAINT "facturas_importe_exento_no_negativo" CHECK ("facturas"."importe_exento" >= 0),
	CONSTRAINT "facturas_importe_no_gravado_no_negativo" CHECK ("facturas"."importe_no_gravado" >= 0),
	CONSTRAINT "facturas_importe_tributos_no_negativo" CHECK ("facturas"."importe_tributos" >= 0),
	CONSTRAINT "facturas_descuento_porcentaje_valido" CHECK ("facturas"."descuento_porcentaje" >= 0 and "facturas"."descuento_porcentaje" <= 100)
);
--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "comprobante_id" integer;--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_movimiento_id_user_movimientos_id_user_fk" FOREIGN KEY ("movimiento_id","user") REFERENCES "public"."movimientos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_comprobante_id_comprobantes_id_fk" FOREIGN KEY ("comprobante_id") REFERENCES "public"."comprobantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comprobantes_movimiento_por_cuenta_idx" ON "comprobantes" USING btree ("user","movimiento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comprobantes_numeracion_idx" ON "comprobantes" USING btree ("user","tipo","punto_venta","numero") WHERE "comprobantes"."numero" is not null;--> statement-breakpoint
CREATE INDEX "comprobantes_user_estado_idx" ON "comprobantes" USING btree ("user","estado");--> statement-breakpoint
CREATE INDEX "comprobantes_user_fecha_idx" ON "comprobantes" USING btree ("user","fecha");--> statement-breakpoint
CREATE INDEX "comprobantes_user_tipo_idx" ON "comprobantes" USING btree ("user","tipo");--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_comprobante_id_user_comprobantes_id_user_fk" FOREIGN KEY ("comprobante_id","user") REFERENCES "public"."comprobantes"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_comprobante_idx" ON "pedidos" USING btree ("comprobante_id") WHERE "pedidos"."comprobante_id" is not null;