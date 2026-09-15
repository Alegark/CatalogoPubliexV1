ALTER TABLE "banners" ADD COLUMN "product_id" integer;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "banners_product_idx" ON "banners" USING btree ("product_id");