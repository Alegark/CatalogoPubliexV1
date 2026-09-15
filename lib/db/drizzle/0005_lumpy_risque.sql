CREATE TABLE "login_attempts" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "key" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
DELETE FROM "exchange_rate" older
USING "exchange_rate" newer
WHERE older."key" = newer."key" AND older."id" < newer."id";--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rate_key_unique" ON "exchange_rate" USING btree ("key");
