export type NetworkId = "arc-testnet" | "arc-mainnet";
export type Tone = "friendly" | "professional" | "firm";
export type Workflow = "draft" | "open" | "verification_pending" | "archived";
export type PaymentStatus =
  | "draft"
  | "unpaid"
  | "due_soon"
  | "overdue"
  | "partially_paid"
  | "verification_pending"
  | "paid"
  | "archived";
export type CommunicationStatus = "none" | "draft" | "snoozed" | "sent" | "responded";
export type PaymentKind = "demo" | "live" | "unverified" | "rejected";
export type FollowStatus = "draft" | "snoozed" | "sent" | "responded";
export type VerificationLabel = "none" | "demo" | "live" | "live-partial" | "pending";

export type Check = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type PaymentView = {
  id: string;
  invoiceId: string;
  amountCents: number;
  currency: string;
  network: string;
  recipientAddress: string;
  txHash: string;
  kind: PaymentKind;
  isDemo: boolean;
  countsTowardBalance: boolean;
  explorerUrl: string;
  summary: string;
  checks: Check[];
  createdAt: string;
};

export type FollowUpView = {
  id: string;
  invoiceId: string;
  tone: Tone;
  body: string;
  status: FollowStatus;
  snoozeUntil: string | null;
  sentAt: string | null;
  responseNote: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceView = {
  id: string;
  reference: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  description: string;
  amountCents: number;
  paidCents: number;
  livePaidCents: number;
  demoPaidCents: number;
  remainingCents: number;
  overpaidCents: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  recipientAddress: string;
  workflow: Workflow;
  notes: string;
  paymentStatus: PaymentStatus;
  pastDue: boolean;
  verificationLabel: VerificationLabel;
  communicationStatus: CommunicationStatus;
  needsAttention: boolean;
  snoozeUntil: string | null;
  createdAt: string;
  updatedAt: string;
  payments: PaymentView[];
  followUps: FollowUpView[];
  receipt: { id: string; kind: "demo" | "live" } | null;
};

export type ActivityView = {
  id: string;
  invoiceId: string | null;
  kind: string;
  message: string;
  createdAt: string;
};

export type SettingsView = {
  businessName: string;
  ownerName: string;
  email: string;
  timezone: string;
  displayCurrency: string;
  reminderLeadDays: number;
  defaultTone: Tone;
  network: NetworkId;
  recipientAddress: string;
  networkName: string;
  chainId: number;
  explorerUrl: string;
  rpcHost: string;
  faucetUrl: string | null;
  docsUrl: string;
  dataMode: string;
};

export type Metrics = {
  outstandingCents: number;
  overdueCount: number;
  dueSoonCount: number;
  verifiedCents: number;
  recordedCents: number;
  attentionCount: number;
  openCount: number;
};

export type ActionItem = {
  id: string;
  invoiceId: string;
  priority: number;
  title: string;
  detail: string;
  href: string;
  label: string;
};

export type WorkspaceData = {
  settings: SettingsView;
  today: string;
  invoices: InvoiceView[];
  activities: ActivityView[];
  metrics: Metrics;
  actions: ActionItem[];
};

export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  draft: "Draft",
  unpaid: "Unpaid",
  due_soon: "Due soon",
  overdue: "Overdue",
  partially_paid: "Partially paid",
  verification_pending: "Verification pending",
  paid: "Paid",
  archived: "Archived",
};

export const COMM_LABEL: Record<CommunicationStatus, string> = {
  none: "No follow-up",
  draft: "Draft ready",
  snoozed: "Snoozed",
  sent: "Marked sent",
  responded: "Response recorded",
};

export const TONE_LABEL: Record<Tone, string> = {
  friendly: "Friendly reminder",
  professional: "Professional follow-up",
  firm: "Firm but respectful",
};
