import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import GoogleSignIn from "@/components/auth/GoogleSignIn";
import { isAuthenticated } from "@/lib/auth";
import { WHEEL_COLORS } from "@/lib/constants";

const Index = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        navigate("/dashboard");
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-light via-white to-orange-light">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left: Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
              Recipe Club Hub
            </h1>
            <p className="text-lg text-gray-500 mb-6 max-w-md mx-auto lg:mx-0">
              Spin the wheel, get your ingredient, and share delicious recipes
              with your club!
            </p>
            <div className="flex justify-center lg:justify-start">
              <GoogleSignIn />
            </div>
          </div>

          {/* Right: Wheel Visualization */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-56 h-56 md:w-72 md:h-72">
              {/* Decorative Wheel */}
              <svg viewBox="0 0 200 200" className="w-full h-full animate-spin-slow">
                <defs>
                  {WHEEL_COLORS.map((color, i) => (
                    <linearGradient
                      key={i}
                      id={`gradient-${i}`}
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor={color} />
                      <stop offset="100%" stopColor={color} stopOpacity="0.7" />
                    </linearGradient>
                  ))}
                </defs>
                {WHEEL_COLORS.map((_, i) => {
                  const angle = (360 / WHEEL_COLORS.length) * i;
                  const nextAngle = (360 / WHEEL_COLORS.length) * (i + 1);
                  const startRad = (angle - 90) * (Math.PI / 180);
                  const endRad = (nextAngle - 90) * (Math.PI / 180);
                  const x1 = 100 + 90 * Math.cos(startRad);
                  const y1 = 100 + 90 * Math.sin(startRad);
                  const x2 = 100 + 90 * Math.cos(endRad);
                  const y2 = 100 + 90 * Math.sin(endRad);
                  const largeArc = nextAngle - angle > 180 ? 1 : 0;

                  return (
                    <path
                      key={i}
                      d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill={`url(#gradient-${i})`}
                      stroke="white"
                      strokeWidth="2"
                    />
                  );
                })}
                <circle cx="100" cy="100" r="20" fill="white" />
                <circle cx="100" cy="100" r="15" fill="#9b87f5" />
              </svg>
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-purple"></div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-12 md:mt-16">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center text-gray-900 mb-6">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 text-center shadow-lg">
              <div className="w-12 h-12 bg-purple rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-white">1</span>
              </div>
              <h3 className="font-display text-lg font-semibold mb-1">
                Spin the Wheel
              </h3>
              <p className="text-gray-600 text-sm">
                Click spin and watch as the wheel selects a random ingredient.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 text-center shadow-lg">
              <div className="w-12 h-12 bg-orange rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-white">2</span>
              </div>
              <h3 className="font-display text-lg font-semibold mb-1">
                Pick a Date
              </h3>
              <p className="text-gray-600 text-sm">
                Choose when your club will meet to share dishes.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 text-center shadow-lg">
              <div className="w-12 h-12 bg-green rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-white">3</span>
              </div>
              <h3 className="font-display text-lg font-semibold mb-1">
                Lock In Your Recipe
              </h3>
              <p className="text-gray-600 text-sm">
                Share what you're making and see what others are cooking!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Custom animation for slow spin */}
      <style>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Index;
