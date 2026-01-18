# Recipe Club Setup Guide

## Prerequisites
- Supabase project
- Google Cloud Console project with OAuth configured

## Database Setup

1. Run `supabase-schema.sql` in your Supabase SQL Editor
2. Run `supabase-migration-photos.sql` to add photo support

## Supabase Storage Setup

1. Go to your Supabase Dashboard → Storage
2. Click "New Bucket"
3. Create a bucket named `recipe-photos`
4. Set it to **Public** (so uploaded photos can be viewed)
5. Add the following storage policy:

### Upload Policy
```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recipe-photos');
```

### Read Policy
```sql
-- Allow anyone to view photos
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'recipe-photos');
```

### Delete Policy
```sql
-- Allow authenticated users to delete their uploads
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'recipe-photos');
```

## Google Calendar Integration

To enable Google Calendar event creation:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Library**
4. Search for "Google Calendar API" and enable it
5. Go to **APIs & Services** → **OAuth consent screen**
6. Add the scope: `https://www.googleapis.com/auth/calendar.events`
7. Go to your Supabase Dashboard → Authentication → Providers → Google
8. Make sure the Google provider is enabled with your OAuth credentials

### Testing Calendar Integration

1. Sign out of the app
2. Sign back in with Google
3. You should see a prompt to grant calendar access
4. Lock in a recipe and check that the calendar event is created

## Admin Users

The following email addresses have admin privileges:
- sarahgsaltz@gmail.com
- hannah.glickman@gmail.com

To add more admins, edit `src/lib/constants.ts` and add emails to the `ADMIN_EMAILS` array.

## Environment Variables

Update `src/integrations/supabase/client.ts` with your Supabase credentials:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY`: Your Supabase anon/public key

## Event Reminder Edge Function

The `send-event-reminders` edge function sends reminder emails to admins at 7 days and 1 day before each scheduled event. The email content varies based on whether the admin has locked in their recipe.

### Setup

1. **Get a Resend API Key**
   - Sign up at [resend.com](https://resend.com)
   - Create an API key in your dashboard
   - (Optional) Add a custom domain for a branded "from" address

2. **Set the Resend API Key in Supabase**
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

3. **Deploy the Edge Function**
   ```bash
   supabase functions deploy send-event-reminders
   ```

4. **Set Up a Cron Schedule**

   Go to your Supabase Dashboard → Database → Extensions and enable `pg_cron` if not already enabled.

   Then run this SQL to schedule the function to run daily at 9 AM UTC:
   ```sql
   SELECT cron.schedule(
     'send-event-reminders',
     '0 9 * * *',
     $$
     SELECT
       net.http_post(
         url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-event-reminders',
         headers := jsonb_build_object(
           'Authorization', 'Bearer ' || 'YOUR_SUPABASE_ANON_KEY',
           'Content-Type', 'application/json'
         ),
         body := '{}'::jsonb
       ) AS request_id;
     $$
   );
   ```

   Replace `YOUR_PROJECT_REF` and `YOUR_SUPABASE_ANON_KEY` with your actual values.

### Testing the Function

You can test the function manually:
```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-event-reminders' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json'
```

### Email Behavior

- **7 days before event**: Sends reminder to all admins
- **1 day before event**: Sends reminder to all admins
- **If recipe locked in**: Email says "Get excited for the event!"
- **If recipe NOT locked in**: Email says "Remember to lock in your recipe!"
