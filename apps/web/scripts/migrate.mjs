import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

await sql`
  create table if not exists public.schema_migrations (
    id text primary key,
    applied_at timestamptz not null default now()
  )
`;

const directory = join(root, "supabase/migrations");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

for (const file of files) {
  const [existing] = await sql`select id from public.schema_migrations where id = ${file}`;
  if (existing) {
    console.log(`skip ${file}`);
    continue;
  }

  const body = await readFile(join(directory, file), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`insert into public.schema_migrations (id) values (${file})`;
  });
  console.log(`applied ${file}`);
}

await sql.end();
