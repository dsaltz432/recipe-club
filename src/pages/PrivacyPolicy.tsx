import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="text-primary hover:underline text-sm mb-8 inline-block"
        >
          &larr; Back to Recipe Club
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">
          Last updated: February 25, 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">Overview</h2>
            <p>
              Recipe Club Hub ("we", "our", "the app") is a private web
              application for organizing recipe club events among friends. We
              respect your privacy and are committed to protecting your personal
              data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              Information We Collect
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Google account information:</strong> When you sign in
                with Google, we receive your name, email address, and profile
                photo to identify you within the app.
              </li>
              <li>
                <strong>Google Calendar access:</strong> We request permission to
                create, update, and delete events on your Google Calendar so that
                recipe club events appear on your calendar with Google Meet links
                and attendee information.
              </li>
              <li>
                <strong>Recipes and notes:</strong> Any recipes, notes, photos,
                or meal plans you create within the app are stored in our
                database.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              How We Use Google Calendar Data
            </h2>
            <p>We use Google Calendar access exclusively to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                Create calendar events for scheduled recipe club gatherings
              </li>
              <li>
                Update event details (time, location, attendees) when they change
              </li>
              <li>Remove calendar events when a recipe club event is canceled</li>
              <li>
                Include Google Meet video conferencing links for remote
                participants
              </li>
            </ul>
            <p className="mt-2">
              We do not read, analyze, or store the contents of your existing
              calendar events. We only interact with events that Recipe Club Hub
              creates.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Data Storage</h2>
            <p>
              Your data is stored securely using{" "}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Supabase
              </a>
              , a hosted database platform. Google OAuth refresh tokens are
              stored encrypted in our database solely to maintain your calendar
              integration without requiring repeated sign-ins.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Data Sharing</h2>
            <p>
              We do not sell, trade, or share your personal data with third
              parties. Your data is only used within Recipe Club Hub to provide
              the app's functionality. Other members of your recipe club can see
              shared content like event details, recipes, and recipe notes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Data Retention</h2>
            <p>
              Your data is retained as long as your account is active. You may
              request deletion of your account and associated data at any time by
              contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              Revoking Access
            </h2>
            <p>
              You can revoke Recipe Club Hub's access to your Google account at
              any time through your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google Account permissions
              </a>{" "}
              page. This will disable the calendar integration but will not
              delete your recipes or other app data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Contact</h2>
            <p>
              If you have questions about this privacy policy or want to request
              data deletion, please reach out to the app administrator.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
