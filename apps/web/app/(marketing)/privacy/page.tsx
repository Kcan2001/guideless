import type { Metadata } from "next";
import { brand } from "@guideless/config";
import { LegalPage } from "@/components/legal/legal-page";
import { privacy } from "@/content/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `What ${brand.legalName} (${brand.name}) collects to organize your trip, why, who processes it, and the choices you have.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalPage doc={privacy} />;
}
