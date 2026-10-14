import { json, route } from "@/lib/http";
import { getSession } from "@/lib/session";

export const GET = route(async () => {
  const session = await getSession();
  return json({ address: session.address ?? null });
});
