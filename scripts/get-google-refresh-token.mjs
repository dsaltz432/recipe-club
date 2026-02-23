#!/usr/bin/env node
/**
 * One-time script to obtain a Google OAuth refresh token for local development.
 *
 * Prerequisites:
 *   1. Add http://localhost:8765/callback as an "Authorized redirect URI"
 *      in your Google Cloud Console OAuth 2.0 Client.
 *   2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET below or as env vars.
 *
 * Usage:
 *   node scripts/get-google-refresh-token.mjs
 */

import http from "node:http";
import { execSync } from "node:child_process";
import { URL } from "node:url";

// --- Configuration ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = "http://localhost:8765/callback";
const PORT = 8765;

// Scopes needed for Google Calendar
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "\n  Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.\n" +
    "  Set them as environment variables:\n\n" +
    "    GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node scripts/get-google-refresh-token.mjs\n"
  );
  process.exit(1);
}

// Build the Google OAuth consent URL
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent"); // Force consent to guarantee refresh_token

// Start a temporary local server to capture the callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h1>Error</h1><p>${error}</p>`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end("<h1>Error</h1><p>No authorization code received.</p>");
    server.close();
    process.exit(1);
  }

  // Exchange the authorization code for tokens
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("\nToken exchange failed:", tokens);
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h1>Token exchange failed</h1><pre>${JSON.stringify(tokens, null, 2)}</pre>`);
      server.close();
      process.exit(1);
    }

    if (!tokens.refresh_token) {
      console.error("\nNo refresh_token in response. Make sure prompt=consent is set.");
      console.error("Response:", tokens);
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("<h1>No refresh token received</h1><p>Try revoking access at <a href='https://myaccount.google.com/permissions'>Google Account Permissions</a> and running again.</p>");
      server.close();
      process.exit(1);
    }

    // Success!
    console.log("\n=== Google OAuth Tokens ===");
    console.log(`\nRefresh Token: ${tokens.refresh_token}`);
    console.log(`Access Token:  ${tokens.access_token}`);
    console.log(`\nNow insert into your local Supabase DB:`);
    console.log(`\n  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\\`);
    console.log(`    INSERT INTO user_tokens (user_id, provider, refresh_token)\\`);
    console.log(`    VALUES ('<YOUR_LOCAL_USER_ID>', 'google', '${tokens.refresh_token}')\\`);
    console.log(`    ON CONFLICT (user_id, provider) DO UPDATE SET refresh_token = EXCLUDED.refresh_token;"`);
    console.log(`\n  (Replace <YOUR_LOCAL_USER_ID> with your user ID from auth.users)\n`);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <h1 style="color: green;">Success!</h1>
      <p>Refresh token obtained. Check your terminal for the token and SQL command.</p>
      <p>You can close this tab.</p>
    `);
  } catch (err) {
    console.error("\nError exchanging code:", err);
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h1>Error</h1><pre>${err.message}</pre>`);
  }

  server.close();
});

server.listen(PORT, () => {
  console.log(`\nListening on http://localhost:${PORT}`);
  console.log(`\nOpening Google consent screen in your browser...`);
  console.log(`(Sign in with dsaltz190@gmail.com)\n`);

  // Open browser on macOS
  try {
    execSync(`open "${authUrl.toString()}"`);
  } catch {
    console.log(`If the browser didn't open, visit:\n\n  ${authUrl.toString()}\n`);
  }
});
