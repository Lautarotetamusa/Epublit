ALTER TABLE "libros" ADD COLUMN "stock_negativo_permitido" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "libros" ADD COLUMN "peso_kg" real;--> statement-breakpoint
ALTER TABLE "libros" ADD CONSTRAINT "libros_stock_negativo_permitido_no_negativo" CHECK ("libros"."stock_negativo_permitido" >= 0);--> statement-breakpoint
ALTER TABLE "libros" ADD CONSTRAINT "libros_peso_kg_positivo" CHECK ("libros"."peso_kg" is null or "libros"."peso_kg" > 0);