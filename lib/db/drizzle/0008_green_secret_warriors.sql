CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"product_id" integer,
	"product_slug" text,
	"product_name" text,
	"category_name" text,
	"source" text,
	"size_name" text,
	"quantity" integer,
	"item_count" integer,
	"amount_usd" numeric(12, 2)
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;