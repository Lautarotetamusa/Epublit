CREATE TYPE "public"."libro_tipo_edicion" AS ENUM('normal', 'pop_up', 'cartone');--> statement-breakpoint
CREATE TABLE "libro_resenas" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "libro_resenas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_libro" integer NOT NULL,
	"url" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user" integer NOT NULL,
	CONSTRAINT "libro_resenas_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "libro_resenas_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "libros" ADD COLUMN "tipo_edicion" "libro_tipo_edicion" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "libros" ADD COLUMN "visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "libro_resenas" ADD CONSTRAINT "libro_resenas_id_libro_libros_id_libro_fk" FOREIGN KEY ("id_libro") REFERENCES "public"."libros"("id_libro") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libro_resenas" ADD CONSTRAINT "libro_resenas_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;