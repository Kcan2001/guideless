import type { Metadata } from "next";
import { brand } from "@guideless/config";
import { LegalPage } from "@/components/legal/legal-page";
import { bookingAgreement } from "@/content/legal/booking-agreement";

export const metadata: Metadata = {
  title: "Booking Agreement",
  description: `The contract for your trip with ${brand.legalName} (${brand.name}): what we organise, what you are responsible for, what happens if either of us cancels.`,
  alternates: { canonical: "/booking-agreement" },
};

export default function BookingAgreementPage() {
  return <LegalPage doc={bookingAgreement} />;
}
