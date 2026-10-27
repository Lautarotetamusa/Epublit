CREATE TYPE "public"."pedido_entrega_tipo" AS ENUM('envio', 'retiro');--> statement-breakpoint
CREATE TYPE "public"."pedido_estado" AS ENUM('pendiente_pago', 'pagado', 'aceptado', 'rechazado', 'enviado', 'entregado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."pedido_pago_estado" AS ENUM('pendiente', 'aprobado', 'rechazado', 'reembolsado');--> statement-breakpoint
CREATE TYPE "public"."reserva_estado" AS ENUM('activa', 'liberada', 'convertida');--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "pedidos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"integracion_id" integer NOT NULL,
	"codigo" varchar(30) NOT NULL,
	"referencia_externa" varchar(120) NOT NULL,
	"clave_idempotencia" varchar(200) NOT NULL,
	"comprador_nombre" varchar(160) NOT NULL,
	"comprador_email" varchar(255) NOT NULL,
	"comprador_telefono" varchar(40),
	"comprador_documento" varchar(40),
	"entrega_tipo" "pedido_entrega_tipo" NOT NULL,
	"entrega_calle" varchar(160),
	"entrega_numero" varchar(20),
	"entrega_piso" varchar(20),
	"entrega_localidad" varchar(120),
	"entrega_provincia" varchar(120),
	"entrega_codigo_postal" varchar(12),
	"retiro_direccion" text,
	"retiro_horario" text,
	"peso_kg" real,
	"estado" "pedido_estado" DEFAULT 'pendiente_pago' NOT NULL,
	"estado_pago" "pedido_pago_estado" DEFAULT 'pendiente' NOT NULL,
	"moneda" varchar(3) DEFAULT 'ARS' NOT NULL,
	"subtotal" real NOT NULL,
	"costo_envio" real DEFAULT 0 NOT NULL,
	"total" real NOT NULL,
	"motivo_rechazo" text,
	"detalle_rechazo" text,
	"venta_id" integer,
	"comprobante_tipo" varchar(2),
	"comprobante_numero" varchar(30),
	"comprobante_fecha" timestamp,
	"comprobante_file_path" text,
	"comprobante_estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "pedidos_id_unique" UNIQUE("id"),
	CONSTRAINT "pedidos_subtotal_no_negativo" CHECK ("pedidos"."subtotal" >= 0),
	CONSTRAINT "pedidos_costo_envio_no_negativo" CHECK ("pedidos"."costo_envio" >= 0),
	CONSTRAINT "pedidos_total_no_negativo" CHECK ("pedidos"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pedido_items" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "pedido_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"pedido_id" integer NOT NULL,
	"isbn" varchar(13) NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"precio_unitario" real NOT NULL,
	"cantidad" integer NOT NULL,
	"subtotal" real NOT NULL,
	CONSTRAINT "pedido_items_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "pedido_items_id_unique" UNIQUE("id"),
	CONSTRAINT "pedido_items_cantidad_positiva" CHECK ("pedido_items"."cantidad" > 0),
	CONSTRAINT "pedido_items_precio_no_negativo" CHECK ("pedido_items"."precio_unitario" >= 0),
	CONSTRAINT "pedido_items_subtotal_no_negativo" CHECK ("pedido_items"."subtotal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "reservas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"pedido_id" integer NOT NULL,
	"id_libro" integer NOT NULL,
	"deposito_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"estado" "reserva_estado" DEFAULT 'activa' NOT NULL,
	"expira_en" timestamp NOT NULL,
	"creada_en" timestamp DEFAULT now() NOT NULL,
	"actualizada_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reservas_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "reservas_id_unique" UNIQUE("id"),
	CONSTRAINT "reservas_cantidad_positiva" CHECK ("reservas"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "pedido_historial" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "pedido_historial_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user" integer NOT NULL,
	"pedido_id" integer NOT NULL,
	"tipo" varchar(40) NOT NULL,
	"descripcion" text NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pedido_historial_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "pedido_historial_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_integracion_id_user_integraciones_id_user_fk" FOREIGN KEY ("integracion_id","user") REFERENCES "public"."integraciones"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_venta_id_user_movimientos_id_user_fk" FOREIGN KEY ("venta_id","user") REFERENCES "public"."movimientos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_user_pedidos_id_user_fk" FOREIGN KEY ("pedido_id","user") REFERENCES "public"."pedidos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_pedido_id_user_pedidos_id_user_fk" FOREIGN KEY ("pedido_id","user") REFERENCES "public"."pedidos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_id_libro_user_libros_id_libro_user_fk" FOREIGN KEY ("id_libro","user") REFERENCES "public"."libros"("id_libro","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_deposito_id_user_depositos_id_user_fk" FOREIGN KEY ("deposito_id","user") REFERENCES "public"."depositos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_historial" ADD CONSTRAINT "pedido_historial_pedido_id_user_pedidos_id_user_fk" FOREIGN KEY ("pedido_id","user") REFERENCES "public"."pedidos"("id","user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_codigo_por_cuenta_idx" ON "pedidos" USING btree ("user","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_referencia_externa_idx" ON "pedidos" USING btree ("referencia_externa");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_idempotencia_integracion_idx" ON "pedidos" USING btree ("integracion_id","clave_idempotencia");--> statement-breakpoint
CREATE INDEX "pedidos_user_fecha_idx" ON "pedidos" USING btree ("user","creado_en");--> statement-breakpoint
CREATE INDEX "pedidos_user_estado_idx" ON "pedidos" USING btree ("user","estado");--> statement-breakpoint
CREATE INDEX "pedidos_user_entrega_idx" ON "pedidos" USING btree ("user","entrega_tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_items_pedido_isbn_idx" ON "pedido_items" USING btree ("pedido_id","isbn");--> statement-breakpoint
CREATE UNIQUE INDEX "reservas_pedido_libro_idx" ON "reservas" USING btree ("pedido_id","id_libro");--> statement-breakpoint
CREATE INDEX "reservas_user_libro_estado_idx" ON "reservas" USING btree ("user","id_libro","estado");--> statement-breakpoint
CREATE INDEX "reservas_estado_expira_idx" ON "reservas" USING btree ("estado","expira_en");--> statement-breakpoint
CREATE INDEX "pedido_historial_pedido_fecha_idx" ON "pedido_historial" USING btree ("pedido_id","fecha");