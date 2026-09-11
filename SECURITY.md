# Security notes

- Do not reuse any password that was previously typed into a chat, email, ticket, or shared document.
- Generate a fresh password and store only a bcrypt hash in `ADMIN_PASSWORD_HASH`.
- Keep `SESSION_SECRET`, Google service-account JSON, and future Field Nation credentials in hosting environment variables.
- Do not place secrets in `/public`, GitHub source files, browser JavaScript, or Google Sheet cells.
- Use HTTPS. Render provides TLS for its public web-service domain and custom domains.
- The current single-admin login is appropriate for an internal pilot. Before adding multiple users, move user records to a database and implement role-based access.
- If the Google Sheet contains sensitive customer or technician information, use the private service-account connection, not Publish to Web.
