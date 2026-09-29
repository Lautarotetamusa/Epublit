CREATE TABLE "colecciones" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "colecciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"titulo" varchar(60) NOT NULL,
	"descripcion" text,
	"portada_key" text,
	"user" integer NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "colecciones_id_user_pk" PRIMARY KEY("id","user"),
	CONSTRAINT "colecciones_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "libros" ADD COLUMN "coleccion_id" integer;--> statement-breakpoint
ALTER TABLE "colecciones" ADD CONSTRAINT "colecciones_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libros" ADD CONSTRAINT "libros_coleccion_id_colecciones_id_fk" FOREIGN KEY ("coleccion_id") REFERENCES "public"."colecciones"("id") ON DELETE no action ON UPDATE no action;