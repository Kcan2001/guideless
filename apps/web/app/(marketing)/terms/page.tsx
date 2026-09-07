import type { Metadata } from "next";
import { brand } from "@guideless/config";
import { LegalPage } from "@/components/legal/legal-page";
import { terms } from "@/content/legal/terms";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms between you and ${brand.legalName} (${brand.name}) when you book a trip or use the app. Short, readable, no surprises.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalPage doc={terms} />;
}
