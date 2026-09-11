import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function TourNotFound() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start px-6 py-32">
      <p className="eyebrow text-muted-foreground">Not found</p>
      <h1 className="mt-3 text-4xl md:text-5xl">That route isn&rsquo;t on the map.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The trip may have been renamed or retired. Every current route is listed on the trips page.
      </p>
      <Link href="/tours" className={buttonVariants({ size: "lg" }) + " mt-8"}>
        See all trips
      </Link>
    </section>
  );
}
