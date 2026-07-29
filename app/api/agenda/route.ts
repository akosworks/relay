import { getAgenda } from "@/lib/agenda";

/** Everything memory holds that belongs to a day. */
export async function GET() {
  return Response.json(await getAgenda());
}
