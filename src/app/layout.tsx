import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Outfit, Syne } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "SettleSignal",
    template: "%s · SettleSignal",
  },
  description: "Track unpaid invoices, follow up with confidence, and keep trustworthy evidence of payments in one workspace.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${syne.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
