import postgres from "postgres";
import { GameError } from "./errors";

type Sql = ReturnType<typeof postgres>;

const globalForSql = globalThis as unknown as { cyberpizzaSql?: Sql };

export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new GameError(
      503,
      "database_not_configured",
      "DATABASE_URL is not set. Point it at Postgres, then run pnpm db:migrate.",
    );
  }

  if (!globalForSql.cyberpizzaSql) {
    globalForSql.cyberpizzaSql = postgres(url, {
      max: 10,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  return globalForSql.cyberpizzaSql;
}
