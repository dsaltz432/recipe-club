import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GoogleSignIn from "@/components/auth/GoogleSignIn";
import { isAuthenticated } from "@/lib/auth";
import { CalendarDays, ShoppingCart, BookOpen, Star } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (!mounted) return;
      if (authenticated) {
        const redirect = sessionStorage.getItem("postLoginRedirect");
        if (redirect) {
          sessionStorage.removeItem("postLoginRedirect");
          navigate(redirect);
        } else {
          navigate("/dashboard");
        }
      }
      setIsLoading(false);
    };

    checkAuth();
    return () => { mounted = false; };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  const features = [
    { icon: CalendarDays, label: "Meal Planning",   desc: "Plan your personal weekly meals",     iconColor: "text-purple",     bgColor: "bg-purple/10",  accent: "#9b87f5" },
    { icon: ShoppingCart, label: "Grocery Lists",   desc: "Auto-generated shopping lists",       iconColor: "text-orange",     bgColor: "bg-orange/10",  accent: "#F97316" },
    { icon: BookOpen,     label: "Recipe Library",  desc: "Browse all club recipes",             iconColor: "text-green",      bgColor: "bg-green/10",   accent: "#22c55e" },
    { icon: Star,         label: "Ratings & Notes", desc: "Rate recipes and add personal notes", iconColor: "text-yellow-500", bgColor: "bg-yellow-50",  accent: "#EAB308" },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(150deg, #fdfcff 0%, #f4f0ff 50%, #fff8f2 100%)" }}>

      {/* Ambient glows — more visible */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(155,135,245,0.22) 0%, transparent 65%)" }} />
      <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(251,146,60,0.18) 0%, transparent 65%)" }} />

      {/* Two-column layout — stretch to full height, center content within each column */}
      <div className="relative z-10 min-h-screen flex flex-col md:flex-row md:items-stretch max-w-5xl mx-auto">

        {/* ── Left: Branding + Sign In ── */}
        <div className="flex-1 flex flex-col justify-center text-center md:text-left px-6 py-5 md:px-14 md:py-20" style={{ animation: "rch-rise 0.55s ease-out both" }}>

          <h1 className="font-display font-bold text-gray-900 leading-[1.0] mb-3 md:mb-4" style={{ fontSize: "clamp(2rem, 5.5vw, 4.5rem)" }}>
            Recipe<br className="hidden md:block" /> <span style={{ color: "#9b87f5" }}>Club</span> Hub
          </h1>

          <p className="text-gray-500 leading-relaxed mb-4 md:mb-6 mx-auto md:mx-0" style={{ fontSize: "0.9rem", maxWidth: "26rem" }}>
            Share recipes, plan meals, and build grocery lists. Your recipe hub, all in one place.
          </p>

          {/* Sign-in panel */}
          <div className="rounded-2xl p-5 w-full md:max-w-[22rem] mx-auto md:mx-0" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(155,135,245,0.18)", boxShadow: "0 8px 40px rgba(155,135,245,0.12), 0 2px 8px rgba(0,0,0,0.05)" }}>
            <GoogleSignIn />
          </div>
        </div>

        {/* ── Vertical divider (desktop only) ── */}
        <div className="hidden md:block w-px shrink-0 my-16" style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(155,135,245,0.25) 25%, rgba(155,135,245,0.25) 75%, transparent 100%)" }} />

        {/* ── Right: Feature cards ── */}
        <div className="flex-1 flex flex-col justify-center px-6 py-3 md:px-14 md:py-20" style={{ animation: "rch-rise 0.55s ease-out 0.14s both" }}>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-3 md:mb-4 text-center md:text-left" style={{ color: "#b0a8c8" }}>
            Everything You Need
          </p>

          {/* Mobile: 2-col grid. Desktop: 1-col stack */}
          <div className="grid grid-cols-2 md:flex md:flex-col gap-2 md:gap-3">
            {features.map(({ icon: Icon, label, desc, iconColor, bgColor, accent }, i) => (
              <div
                key={label}
                className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 rounded-xl px-3 md:px-5 py-3 md:py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  background: "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.9)",
                  borderLeft: `3px solid ${accent}`,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.045)",
                  animation: `rch-rise 0.45s ease-out ${0.2 + i * 0.07}s both`,
                }}
              >
                <div className={`shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-xl ${bgColor} ${iconColor} flex items-center justify-center`}>
                  <Icon className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 leading-tight text-xs md:text-sm">{label}</p>
                  <p className="text-gray-400 leading-snug mt-0.5 text-xs hidden md:block">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center pb-5">
        <Link to="/privacy" className="text-xs hover:text-gray-500 transition-colors" style={{ color: "#c4bedd" }}>
          Privacy Policy
        </Link>
      </footer>

      <style>{`
        @keyframes rch-rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Index;
