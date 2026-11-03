ALTER TABLE "libros" RENAME COLUMN "edad_recomendada" TO "edad_min";--> statement-breakpoint
ALTER TABLE "libros" ADD COLUMN "edad_max" integer;--> statement-breakpoint
ALTER TABLE "anticipos" ADD COLUMN "recuperado" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "liquidacion_personas" ADD COLUMN "anticipo" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "liquidacion_lineas" ADD COLUMN "anticipo" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "libros" ADD CONSTRAINT "libros_edad_min_no_negativa" CHECK ("libros"."edad_min" is null or "libros"."edad_min" >= 0);--> statement-breakpoint
ALTER TABLE "libros" ADD CONSTRAINT "libros_edad_max_no_negativa" CHECK ("libros"."edad_max" is null or "libros"."edad_max" >= 0);--> statement-breakpoint
ALTER TABLE "libros" ADD CONSTRAINT "libros_edad_rango_valido" CHECK ("libros"."edad_min" is null or "libros"."edad_max" is null or "libros"."edad_max" >= "libros"."edad_min");
