import Link from "next/link";

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#d6f25c" />
      <path d="M6.5 21.5c3.1-6.6 5-6.8 7-2.1 1.5 3.5 2.7 3.6 4.1-.1 1.7-4.6 3.2-6.4 6.4-6.4" fill="none" stroke="#14180c" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo-lockup" aria-label="SettleSignal home">
      <Mark />
      <span>SettleSignal</span>
    </Link>
  );
}
