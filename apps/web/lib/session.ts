import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { GameError } from "./errors";

export type SessionData = {
  nonce?: string;
  address?: string;
};

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET ?? "";
  if (password.length < 32) {
    throw new GameError(
      503,
      "session_not_configured",
      "SESSION_SECRET must be at least 32 characters.",
    );
  }

  return {
    cookieName: "cyberpizza_session",
    password,
    ttl: 60 * 60 * 24 * 14,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}
