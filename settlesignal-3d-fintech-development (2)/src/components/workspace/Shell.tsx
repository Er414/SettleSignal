"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { FileText, LayoutDashboard, Menu, MessageSquare, Receipt, RotateCcw, Settings, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/brand";
import { Dialog } from "@/components/interactive";
import type { SettingsView } from "@/lib/types";
import { resetDemo } from "@/server/actions";

const links = [
  { href: "/workspace", label: "Dashboard", hint: "What needs attention", icon: LayoutDashboard },
  { href: "/workspace/invoices", label: "Invoices", hint: "Open balances", icon: FileText },
  { href: "/workspace/follow-ups", label: "Follow-ups", hint: "Drafts you send", icon: MessageSquare },
  { href: "/workspace/verify", label: "Verification", hint: "Arc lookups", icon: ShieldCheck },
  { href: "/workspace/receipts", label: "Receipts", hint: "Evidence", icon: Receipt },
  { href: "/workspace/settings", label: "Settings", hint: "Workspace", icon: Settings },
];

function isActive(path: string, href: string) {
  return href === "/workspace" ? path === href : path.startsWith(href);
}

export function Shell({ settings, children }: { settings: SettingsView; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const close = useCallback(() => setConfirm(false), []);
  useEffect(() => setOpen(false), [path]);

  function onReset() {
    startTransition(async () => {
      const result = await resetDemo();
      setMessage(result.ok ? result.message || "Reset." : result.error);
      setConfirm(false);
      router.refresh();
    });
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar no-print">
        <nav aria-label="Workspace">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className={`side-link ${isActive(path, link.href) ? "active" : ""}`}>
                <Icon size={16} />
                <span>{link.label}<small>{link.hint}</small></span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="app-frame">
        <header className="topbar no-print">
          <div className="top-brand">
            <Logo href="/" />
            <p>{settings.businessName} · {settings.networkName} · chain {settings.chainId}</p>
          </div>
          <div className="header-actions">
            <p className="announce" role="status">{message}</p>
            <button type="button" className="btn-ghost btn-small" onClick={() => setConfirm(true)}>
              <RotateCcw size={14} /> Reset demo
            </button>
            <button type="button" className="icon-btn menu-toggle" aria-expanded={open} aria-label="Open menu" onClick={() => setOpen((value) => !value)}>
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </header>
        <div className={`menu-panel no-print ${open ? "open" : ""}`}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
          ))}
        </div>
        <div id="main" className="app-content">{children}</div>
      </div>
      <nav className="bottom-nav no-print" aria-label="Mobile">
        {links.slice(0, 5).map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className={isActive(path, link.href) ? "active" : ""}>
              <Icon size={16} />
              {link.label.split("-")[0]}
            </Link>
          );
        })}
      </nav>
      <Dialog open={confirm} title="Reset demonstration data?" onClose={close}>
        <p>This replaces invoices, follow-ups, and payment records with the original demo set. It does not touch a wallet.</p>
        <div className="cta-row">
          <button type="button" className="btn-danger" disabled={pending} onClick={onReset}>Reset demo data</button>
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
        </div>
      </Dialog>
    </div>
  );
}
