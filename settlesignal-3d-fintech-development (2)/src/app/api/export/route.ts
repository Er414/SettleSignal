import { invoiceCsv } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const csv = await invoiceCsv();
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"settlesignal-invoices.csv\"",
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
