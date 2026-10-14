import { sql } from "drizzle-orm";
import { db } from "@/db";

let schemaReady: Promise<void> | null = null;

const DDL = [
  `create extension if not exists pgcrypto`,
  `create table if not exists workspace_settings (
    id text primary key,
    business_name text not null,
    owner_name text not null,
    email text not null,
    timezone text not null,
    display_currency text not null,
    reminder_lead_days integer not null,
    default_tone text not null,
    network text not null,
    recipient_address text not null default '',
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists invoices (
    id uuid primary key default gen_random_uuid(),
    reference text not null unique,
    client_name text not null,
    client_email text not null,
    client_company text not null default '',
    description text not null,
    amount_cents integer not null,
    currency text not null default 'USDC',
    issue_date text not null,
    due_date text not null,
    recipient_address text not null default '',
    workflow text not null default 'open',
    notes text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists payments (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references invoices(id) on delete cascade,
    amount_cents integer not null,
    currency text not null default 'USDC',
    network text not null,
    recipient_address text not null default '',
    tx_hash text not null default '',
    kind text not null,
    is_demo boolean not null default false,
    counts_toward_balance boolean not null default false,
    explorer_url text not null default '',
    summary text not null default '',
    checks_json text not null default '[]',
    transfer_key text unique,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists follow_ups (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references invoices(id) on delete cascade,
    tone text not null,
    body text not null,
    status text not null default 'draft',
    snooze_until text,
    sent_at timestamptz,
    response_note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists activities (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid,
    kind text not null,
    message text not null,
    created_at timestamptz not null default now()
  )`,
] as const;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const statement of DDL) {
        await db.execute(sql.raw(statement));
      }
    })();
    schemaReady.catch(() => {
      schemaReady = null;
    });
  }
  return schemaReady;
}
