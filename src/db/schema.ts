import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const workspaceSettings = pgTable("workspace_settings", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  ownerName: text("owner_name").notNull(),
  email: text("email").notNull(),
  timezone: text("timezone").notNull(),
  displayCurrency: text("display_currency").notNull(),
  reminderLeadDays: integer("reminder_lead_days").notNull(),
  defaultTone: text("default_tone").notNull(),
  network: text("network").notNull(),
  recipientAddress: text("recipient_address").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: text("reference").notNull().unique(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientCompany: text("client_company").notNull().default(""),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USDC"),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  recipientAddress: text("recipient_address").notNull().default(""),
  workflow: text("workflow").notNull().default("open"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USDC"),
  network: text("network").notNull(),
  recipientAddress: text("recipient_address").notNull().default(""),
  txHash: text("tx_hash").notNull().default(""),
  kind: text("kind").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  countsTowardBalance: boolean("counts_toward_balance").notNull().default(false),
  explorerUrl: text("explorer_url").notNull().default(""),
  summary: text("summary").notNull().default(""),
  checksJson: text("checks_json").notNull().default("[]"),
  transferKey: text("transfer_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const followUps = pgTable("follow_ups", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  tone: text("tone").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"),
  snoozeUntil: text("snooze_until"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  responseNote: text("response_note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id"),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
