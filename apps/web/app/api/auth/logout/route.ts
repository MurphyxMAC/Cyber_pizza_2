import { json, route } from "@/lib/http";
import { getSession } from "@/lib/session";

export const POST = route(async () => {
  const session = await getSession();
  session.destroy();
  return json({ ok: true });
});
