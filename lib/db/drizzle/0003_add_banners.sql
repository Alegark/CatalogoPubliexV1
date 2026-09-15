CREATE TABLE "banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"storage_path" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "banners_storage_path_unique" UNIQUE("storage_path")
);
--> statement-breakpoint
CREATE INDEX "banners_position_idx" ON "banners" USING btree ("position");