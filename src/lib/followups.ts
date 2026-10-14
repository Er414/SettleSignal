import type { Tone } from "./types";

export function firstName(name: string): string {
  const part = name.trim().split(/\s+/)[0];
  return part || "there";
}

export function renderFollowUp(input: {
  tone: Tone;
  clientName: string;
  reference: string;
  description: string;
  amountLabel: string;
  currency: string;
  dueLabel: string;
  recipientAddress: string;
  networkName: string;
  ownerName: string;
  businessName: string;
  email: string;
}): string {
  const name = firstName(input.clientName);
  const paymentLines = [
    `Invoice: ${input.reference}`,
    `Work: ${input.description}`,
    `Amount: ${input.amountLabel} ${input.currency}`,
    `Due: ${input.dueLabel}`,
  ];
  if (input.recipientAddress) {
    paymentLines.push(`Expected recipient: ${input.recipientAddress}`);
    paymentLines.push(`Network: ${input.networkName}`);
  }
  const facts = paymentLines.join("\n");
  const close = `${input.ownerName}\n${input.businessName}\n${input.email}`;
  if (input.tone === "friendly") {
    return `Hi ${name},\n\nI hope you're well. This is a friendly reminder about ${input.reference}.\n\n${facts}\n\nIf payment is already on the way, a transaction hash lets me confirm settlement. A promise to pay is helpful, but I won't mark the invoice settled until the transfer checks out. If anything looks off, just reply and I'll sort it.\n\nThank you,\n${close}`;
  }
  if (input.tone === "firm") {
    return `Hello ${name},\n\nI'm following up because ${input.reference} is still open. I want to keep this straightforward and respectful.\n\n${facts}\n\nPlease send the outstanding amount, or reply with a transaction hash so I can verify settlement on ${input.networkName}. I can't treat a payment as received until that check succeeds. If there is a dispute about the work, tell me what needs to be resolved and I will respond promptly.\n\nRegards,\n${close}`;
  }
  return `Hello ${name},\n\nI'm following up on ${input.reference}. The work is complete and the invoice is still open in my records.\n\n${facts}\n\nWhen you send payment, please include the transaction hash so I can verify settlement rather than relying on a payment promise. If you need a revised copy or a different recipient address, reply to this note and I will send it.\n\nThank you,\n${close}`;
}
