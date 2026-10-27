ALTER TABLE "envios" ALTER COLUMN "proveedor" SET DEFAULT 'paqar';--> statement-breakpoint
ALTER TABLE "envio_config" ADD COLUMN "micorreo_customer_id" varchar(60);--> statement-breakpoint
ALTER TABLE "envio_config" ADD COLUMN "paqar_agreement" varchar(120);--> statement-breakpoint
ALTER TABLE "envio_config" ADD COLUMN "paqar_api_key_cifrada" text;--> statement-breakpoint
ALTER TABLE "envio_config" ADD COLUMN "paqar_seller_id" varchar(120);--> statement-breakpoint
ALTER TABLE "envio_config" ADD COLUMN "origen_depto" varchar(20);--> statement-breakpoint
ALTER TABLE "envio_config" ADD COLUMN "caja_alto_cm" real DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "envio_config" ADD COLUMN "caja_ancho_cm" real DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "envio_config" ADD COLUMN "caja_largo_cm" real DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "envio_config" ADD COLUMN "formato_etiqueta" varchar(10) DEFAULT '10x15' NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "hash_idempotencia" varchar(64);--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "entrega_depto" varchar(20);--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "caja_alto_cm" real;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "caja_ancho_cm" real;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "caja_largo_cm" real;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "url_retorno" varchar(500);--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "init_point" text;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "vence_en" timestamp;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "fecha_pago" timestamp;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "datos" jsonb;--> statement-breakpoint
ALTER TABLE "envio_config" ADD CONSTRAINT "envio_config_caja_positiva" CHECK ("envio_config"."caja_alto_cm" > 0 and "envio_config"."caja_ancho_cm" > 0 and "envio_config"."caja_largo_cm" > 0);