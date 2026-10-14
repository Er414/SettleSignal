import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoiceDetailView } from "@/components/workspace/InvoiceDetailView";
import { findInvoice } from "@/server/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, invoice } = await findInvoice(id);
  if (!invoice) notFound();
  return <InvoiceDetailView invoice={invoice} settings={data.settings} />;
}
