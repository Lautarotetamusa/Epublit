ALTER TABLE "pedido_items" ADD COLUMN "id_libro" integer;--> statement-breakpoint
ALTER TABLE "envio_eventos" ADD COLUMN "status_id" varchar(80);--> statement-breakpoint
ALTER TABLE "envio_eventos" ADD COLUMN "facility" varchar(160);--> statement-breakpoint
ALTER TABLE "envio_eventos" ADD COLUMN "sign" varchar(160);--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_id_libro_user_libros_id_libro_user_fk" FOREIGN KEY ("id_libro","user") REFERENCES "public"."libros"("id_libro","user") ON DELETE no action ON UPDATE no action;