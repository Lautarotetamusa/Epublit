ALTER TABLE "users" ADD COLUMN "foto_persona_max_size_mb" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "foto_persona_min_ancho_px" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "foto_persona_min_alto_px" integer;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "foto_key" text;