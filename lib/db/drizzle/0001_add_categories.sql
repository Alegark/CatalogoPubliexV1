CREATE TABLE IF NOT EXISTS "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_unique" ON "categories" USING btree ("slug");
--> statement-breakpoint
INSERT INTO "categories" ("name", "slug")
SELECT DISTINCT ON (category_slug) category_name, category_slug
FROM (
	SELECT
		trim("category") AS category_name,
		trim(BOTH '-' FROM regexp_replace(
			translate(lower(trim("category")), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun'),
			'[^a-z0-9]+', '-', 'g'
		)) AS category_slug
	FROM "products"
	WHERE trim("category") <> ''
) AS existing_categories
WHERE category_slug <> ''
ORDER BY category_slug, category_name
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" integer;
--> statement-breakpoint
UPDATE "products" AS product
SET "category_id" = category.id
FROM "categories" AS category
WHERE product."category_id" IS NULL
	AND category."slug" = trim(BOTH '-' FROM regexp_replace(
	translate(lower(trim(product."category")), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun'),
		'[^a-z0-9]+', '-', 'g'
	));
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "products" WHERE "category_id" IS NULL) THEN
		RAISE EXCEPTION 'No se pudieron asignar categorías a todos los productos existentes';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_categories_id_fk'
	) THEN
		ALTER TABLE "products"
			ADD CONSTRAINT "products_category_id_categories_id_fk"
			FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id")
			ON DELETE restrict ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN IF EXISTS "category";
