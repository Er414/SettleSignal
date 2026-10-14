import { loadReceipt } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const { receipt } = await loadReceipt(id);
    if (!receipt || !receipt.eligible) {
      return new Response("A verified or sample receipt is not available for this record.\n", { status: 404 });
    }
    return new Response(receipt.text, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="${receipt.filename}"`,
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Receipt unavailable.\n", { status: 500 });
  }
}
