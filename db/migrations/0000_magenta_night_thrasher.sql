CREATE TYPE "public"."cliente_tipo" AS ENUM('inscripto', 'particular', 'negro');--> statement-breakpoint
CREATE TYPE "public"."libro_persona_tipo" AS ENUM('autor', 'ilustrador');--> statement-breakpoint
CREATE TYPE "public"."transaccion_tipo" AS ENUM('venta', 'consignacion', 'ventaConsignacion', 'devolucion');--> statement-breakpoint
CREATE TYPE "public"."medio_pago" AS ENUM('efectivo', 'debito', 'credito', 'mercadopago', 'transferencia');--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "clientes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(60) NOT NULL,
	"email" varchar(60) DEFAULT '',
	"cuit" varchar(15),
	"cond_fiscal" varchar(50) NOT NULL,
	"razon_social" varchar(255) NOT NULL,
	"domicilio" varchar(100) NOT NULL,
	"tipo" "cliente_tipo",
	"user" integer NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "clientes_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "clientes_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" varchar(25) NOT NULL,
	"password" varchar(60) NOT NULL,
	"cuit" varchar(15) NOT NULL,
	"cond_fiscal" varchar(50) NOT NULL,
	"razon_social" varchar(255) NOT NULL,
	"domicilio" varchar(100) NOT NULL,
	"production" boolean DEFAULT false,
	"email" varchar(255) DEFAULT '',
	"ingresos_brutos" boolean DEFAULT false NOT NULL,
	"fecha_inicio" varchar(10) NOT NULL,
	"punto_venta" integer
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "personas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"dni" varchar(8) NOT NULL,
	"nombre" varchar(60) NOT NULL,
	"email" varchar(60) DEFAULT '',
	"user" integer NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "personas_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "personas_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "libros" (
	"id_libro" integer GENERATED ALWAYS AS IDENTITY (sequence name "libros_id_libro_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"isbn" varchar(13) NOT NULL,
	"titulo" varchar(60) NOT NULL,
	"fecha_edicion" date NOT NULL,
	"precio" real NOT NULL,
	"stock" integer DEFAULT 0,
	"deleted_at" timestamp,
	"user" integer NOT NULL,
	CONSTRAINT "libros_id_libro_user_pk" PRIMARY KEY("id_libro","user"),
	CONSTRAINT "libros_id_libro_unique" UNIQUE("id_libro")
);
--> statement-breakpoint
CREATE TABLE "libro_cliente" (
	"id_cliente" integer NOT NULL,
	"isbn" varchar(13) NOT NULL,
	"stock" integer NOT NULL,
	"id_libro" integer NOT NULL,
	"precio" real NOT NULL,
	CONSTRAINT "libro_cliente_id_libro_id_cliente_pk" PRIMARY KEY("id_libro","id_cliente")
);
--> statement-breakpoint
CREATE TABLE "libros_personas" (
	"isbn" varchar(13) NOT NULL,
	"id_persona" integer NOT NULL,
	"porcentaje" real DEFAULT 0,
	"tipo" "libro_persona_tipo" NOT NULL,
	"id_libro" integer NOT NULL,
	CONSTRAINT "libros_personas_id_libro_id_persona_tipo_pk" PRIMARY KEY("id_libro","id_persona","tipo")
);
--> statement-breakpoint
CREATE TABLE "transacciones" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "transacciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fecha" timestamp DEFAULT now() NOT NULL,
	"id_cliente" integer NOT NULL,
	"file_path" varchar(80) NOT NULL,
	"type" "transaccion_tipo" NOT NULL,
	"user" integer NOT NULL,
	CONSTRAINT "transacciones_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "transacciones_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "libros_transacciones" (
	"id_transaccion" integer NOT NULL,
	"id_libro" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"precio" real DEFAULT 0 NOT NULL,
	CONSTRAINT "libros_transacciones_id_libro_id_transaccion_pk" PRIMARY KEY("id_libro","id_transaccion"),
	CONSTRAINT "cantidad_positiva" CHECK ("libros_transacciones"."cantidad" > 0),
	CONSTRAINT "precio_no_negativo" CHECK ("libros_transacciones"."precio" >= 0)
);
--> statement-breakpoint
CREATE TABLE "precio_libro_cliente" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "precio_libro_cliente_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_libro" integer NOT NULL,
	"id_cliente" integer NOT NULL,
	"precio" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "precio_no_negativo" CHECK ("precio_libro_cliente"."precio" >= 0)
);
--> statement-breakpoint
CREATE TABLE "precio_libros" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "precio_libros_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"isbn" varchar(13) NOT NULL,
	"precio" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user" integer NOT NULL,
	"id_libro" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ventas" (
	"descuento" real DEFAULT 0,
	"total" real NOT NULL,
	"medio_pago" "medio_pago",
	"tipo_cbte" integer NOT NULL,
	"id_transaccion" integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libros" ADD CONSTRAINT "libros_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libro_cliente" ADD CONSTRAINT "libro_cliente_id_cliente_clientes_id_fk" FOREIGN KEY ("id_cliente") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libro_cliente" ADD CONSTRAINT "libro_cliente_id_libro_libros_id_libro_fk" FOREIGN KEY ("id_libro") REFERENCES "public"."libros"("id_libro") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libros_personas" ADD CONSTRAINT "libros_personas_id_persona_personas_id_fk" FOREIGN KEY ("id_persona") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libros_personas" ADD CONSTRAINT "libros_personas_id_libro_libros_id_libro_fk" FOREIGN KEY ("id_libro") REFERENCES "public"."libros"("id_libro") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_id_cliente_clientes_id_fk" FOREIGN KEY ("id_cliente") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libros_transacciones" ADD CONSTRAINT "libros_transacciones_id_transaccion_transacciones_id_fk" FOREIGN KEY ("id_transaccion") REFERENCES "public"."transacciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libros_transacciones" ADD CONSTRAINT "libros_transacciones_id_libro_libros_id_libro_fk" FOREIGN KEY ("id_libro") REFERENCES "public"."libros"("id_libro") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precio_libro_cliente" ADD CONSTRAINT "precio_libro_cliente_id_libro_libros_id_libro_fk" FOREIGN KEY ("id_libro") REFERENCES "public"."libros"("id_libro") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precio_libro_cliente" ADD CONSTRAINT "precio_libro_cliente_id_cliente_clientes_id_fk" FOREIGN KEY ("id_cliente") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precio_libros" ADD CONSTRAINT "precio_libros_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precio_libros" ADD CONSTRAINT "precio_libros_id_libro_libros_id_libro_fk" FOREIGN KEY ("id_libro") REFERENCES "public"."libros"("id_libro") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_id_transaccion_transacciones_id_fk" FOREIGN KEY ("id_transaccion") REFERENCES "public"."transacciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "libros_isbn_user_active_idx" ON "libros" USING btree ("isbn","user") WHERE deleted_at IS NULL;