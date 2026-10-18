# SettleSignal workspace access

The workspace access gate is a single-owner password gate for the existing shared demo ledger. It is not a multi-tenant account system: everyone who signs in reaches the same workspace data.

Configure these as server-only environment variables in the SettleSignal Vercel project, for each environment you intend to use (Production and Preview):

- `SETTLESIGNAL_ADMIN_PASSWORD`: a unique password or passphrase of at least 12 characters.
- `SETTLESIGNAL_ADMIN_SECRET`: an independent random secret of at least 32 characters used to sign expiring session cookies.

Do not prefix either variable with `NEXT_PUBLIC_`, put their values in source control, or share them in chat. Use a password manager or secure random generator to create them. After saving both values in Vercel, redeploy. The public landing page remains available; workspace pages, server actions, invoice CSV export, and receipt downloads require a valid signed session. Sessions expire after seven days.

If either variable is absent or too short, the workspace stays locked. This is intentional fail-closed behavior. The gate is a protective step for the current single-workspace MVP, not a substitute for per-user authentication, tenancy, or rate limiting before broader public use.
