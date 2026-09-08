import type { Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getDepartureById } from "@/lib/data/tours";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The checkout moved to the Trip Builder at /tours/[slug]/build (plan v2 §13). Old links, saved
 * tabs and Stripe cancel URLs from before the move land here and are forwarded with their query.
 * /checkout/[departureId]/confirmation stays where it is.
 */
export default async function CheckoutRedirect(props: PageProps<"/checkout/[departureId]">) {
  const [{ departureId }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!UUID.test(departureId)) notFound();
  const detail = await getDepartureById(departureId);
  if (!detail) notFound();

  const query = new URLSearchParams({ departure: departureId });
  if (sp.cancelled === "1") query.set("cancelled", "1");
  if (typeof sp.step === "string" && /^[a-z]+$/.test(sp.step)) query.set("step", sp.step);
  permanentRedirect(`/tours/${detail.tour.slug}/build?${query.toString()}` as Route);
}
