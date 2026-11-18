-- Cuentas viejas sin entorno definido: nunca facturaron en producción.
UPDATE "users" SET "production" = false WHERE "production" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "production" SET NOT NULL;
