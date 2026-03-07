import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, getAllowedUser, isMemberOrAdmin } from "@/lib/auth";
import type { User } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import AppHeader from "@/components/shared/AppHeader";

const CONTACT_TYPE_OPTIONS = [
  { value: "Question", label: "Question" },
  { value: "Feature Request", label: "Feature Request" },
  { value: "Bug Report", label: "Bug Report" },
] as const;

const ContactUs = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userIsMemberOrAdmin, setUserIsMemberOrAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<string>("Question");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser?.name) setName(currentUser.name); // used in email body, not shown
      if (currentUser?.email) setEmail(currentUser.email); // used as reply-to, not shown
      if (currentUser?.email) {
        const allowed = await getAllowedUser(currentUser.email);
        setUserIsMemberOrAdmin(isMemberOrAdmin(allowed));
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: { name, email, type, message },
      });
      if (error) throw error;
      toast.success("Message sent! We'll get back to you soon.");
      setMessage("");
    } catch (err) {
      console.error("Error sending contact email:", err);
      toast.error("Failed to send message. Please try emailing us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-light/30 via-white to-orange-light/30">
      <AppHeader
        user={user}
        userIsMemberOrAdmin={userIsMemberOrAdmin}
        back={{ label: "Back", onClick: () => window.history.state?.idx > 0 ? navigate(-1) : navigate("/dashboard") }}
        title={
          <h1 className="font-display text-lg sm:text-2xl font-bold text-gray-900 truncate">
            Contact Us
          </h1>
        }
      />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-2xl">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Send us a message</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-2">
                  <Label htmlFor="contact-type">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id="contact-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can we help?"
                    rows={5}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="w-full bg-purple hover:bg-purple/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                Or email us directly at{" "}
                <a
                  href="mailto:contact@therecipeclubhub.com"
                  className="text-purple hover:underline font-medium"
                >
                  contact@therecipeclubhub.com
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ContactUs;
