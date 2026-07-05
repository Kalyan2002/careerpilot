import path from "node:path";
import { defineConfig } from "prisma/config";

const dbPath = path.resolve(__dirname, "prisma", "app.db");
const dbUrl = `file:${dbPath}`;

export default defineConfig({
  schema: path.join("prisma", "schema"),
  datasource: { url: dbUrl },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "bun run prisma/seed/default-boards.ts",
  },
});
