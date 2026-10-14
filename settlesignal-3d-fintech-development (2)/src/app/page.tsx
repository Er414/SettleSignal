import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: { absolute: "SettleSignal — Know what's owed. Know what's settled." },
  description: "Track unpaid invoices, follow up with confidence, and keep trustworthy evidence of payments in one workspace.",
};

export default function HomePage() {
  return <LandingPage />;
}
