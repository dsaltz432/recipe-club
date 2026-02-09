# recipe-club-product-update

Sends a branded product update email announcing the shared grocery list and pantry features to a list of recipients.

## Deploy

```bash
supabase functions deploy recipe-club-product-update
```

## Invoke

```bash
curl -X POST 'https://bluilkrggkspxsnehfez.supabase.co/functions/v1/recipe-club-product-update' \
  -H 'Authorization: Bearer <LEGACY_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"emails":["user1@gmail.com","user2@gmail.com"]}'
```

**Important:** You must use the **legacy anon key** (starts with `eyJ...`), not the new `sb_publishable_` key. Edge functions validate the Authorization header as a JWT, and the new publishable keys are opaque tokens that won't work.

Find the legacy key in: **Supabase Dashboard > Project Settings > API Keys > Legacy anon, service_role API keys**

## Request Body

```json
{
  "emails": ["alice@example.com", "bob@example.com"]
}
```

## Response

```json
{
  "success": true,
  "sent": 2,
  "errors": ["Failed to send to bad@email: ..."]
}
```

The `errors` field is only present if some sends failed.

## Requirements

- `RESEND_API_KEY` must be set in Supabase project secrets. If missing, the function returns `{ "success": true, "sent": 0 }` without error.
