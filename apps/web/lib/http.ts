import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GameError } from "./errors";

const FRIENDLY: Record<string, string> = {
  cooldown: "That topping is still cooling down.",
  cap: "Your tray for that topping is full.",
  "missing ingredients": "The pie needs one of every topping.",
  "nothing to claim": "No CPT is waiting to be claimed.",
  "unknown ingredient": "That topping is not on the menu.",
  "unknown recipe": "That recipe is not on the board.",
  "user not found": "Sign in again to open a shift.",
  "claim not found": "That claim is no longer open.",
};

type PgLike = { code?: string; message?: string };

function asPg(error: unknown): PgLike | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as PgLike;
  if (typeof candidate.code === "string") return candidate;
  return null;
}

function friendly(message: string | undefined) {
  const key = (message ?? "").split("\n")[0]?.trim() ?? "";
  return FRIENDLY[key] ?? "The kitchen refused that action.";
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function toResponse(error: unknown) {
  if (error instanceof GameError) {
    return NextResponse.json(
      { error: error.code, message: error.message, ...(error.details ?? {}) },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "invalid_body", message: "Check the request and try again." },
      { status: 400 },
    );
  }

  const pg = asPg(error);
  if (pg?.code === "P0001") {
    return NextResponse.json({ error: pg.message, message: friendly(pg.message) }, { status: 409 });
  }
  if (pg?.code === "P0002") {
    return NextResponse.json({ error: "not_found", message: friendly(pg.message) }, { status: 404 });
  }
  if (pg?.code === "22023") {
    return NextResponse.json(
      { error: "invalid", message: pg.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  if (pg && ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "57P01", "28P01", "3D000"].includes(pg.code ?? "")) {
    return NextResponse.json(
      { error: "database_unavailable", message: "The kitchen database is unreachable." },
      { status: 503 },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: "internal", message: "Something broke in the kitchen." },
    { status: 500 },
  );
}

export function route(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      return toResponse(error);
    }
  };
}
