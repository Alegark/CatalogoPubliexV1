import "./src/load-env";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit generate only reads the schema. Migrations still require DATABASE_URL.
    url: process.env.DATABASE_URL ?? "postgresql://localhost/placeholder",
  },
});
