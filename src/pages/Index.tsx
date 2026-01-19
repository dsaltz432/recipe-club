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
    <div className="min-h-screen bg-gradient-to-br from-purple-light via-white to-orange-light overflow-hidden">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-6 sm:py-8 md:py-12">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
          {/* Left: Text Content */}
          <div className="flex-1 text-center lg:text-left order-2 lg:order-1">
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-3 sm:mb-4 bg-clip-text">
              Recipe Club Hub
            </h1>
            <p className="text-base sm:text-lg text-gray-600 mb-5 sm:mb-6 max-w-md mx-auto lg:mx-0">
              Spin the wheel, get your ingredient, and share delicious recipes
              with your club!
            </p>
            <div className="flex justify-center lg:justify-start">
              <GoogleSignIn />
            </div>
          </div>

          {/* Right: Wheel Visualization */}
          <div className="flex-1 flex justify-center order-1 lg:order-2">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-72 md:h-72">
              {/* Glow effect behind wheel */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple/30 to-orange/30 rounded-full blur-2xl scale-110"></div>
              {/* Decorative Wheel */}
              <svg viewBox="0 0 200 200" className="w-full h-full animate-spin-slow relative z-10 drop-shadow-xl">
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
                      <stop offset="100%" stopColor={color} stopOpacity="0.8" />
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
                <circle cx="100" cy="100" r="22" fill="white" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))" />
                <circle cx="100" cy="100" r="16" fill="#9b87f5" />
              </svg>
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20">
                <div className="w-0 h-0 border-l-[10px] sm:border-l-[12px] border-r-[10px] sm:border-r-[12px] border-t-[16px] sm:border-t-[20px] border-l-transparent border-r-transparent border-t-purple drop-shadow-lg"></div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-8 sm:mt-12 md:mt-16">
          <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-center text-gray-900 mb-4 sm:mb-6">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center shadow-lg border border-purple/10 hover:shadow-xl hover:border-purple/20 transition-all duration-200">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple to-purple-dark rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-md">
                <span className="text-lg sm:text-xl font-bold text-white">1</span>
              </div>
              <h3 className="font-display text-base sm:text-lg font-semibold mb-1">
                Spin the Wheel
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Click spin and watch as the wheel selects a random ingredient.
              </p>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center shadow-lg border border-orange/10 hover:shadow-xl hover:border-orange/20 transition-all duration-200">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange to-orange-vivid rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-md">
                <span className="text-lg sm:text-xl font-bold text-white">2</span>
              </div>
              <h3 className="font-display text-base sm:text-lg font-semibold mb-1">
                Pick a Date
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Choose when your club will meet to share dishes.
              </p>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center shadow-lg border border-green/10 hover:shadow-xl hover:border-green/20 transition-all duration-200">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green to-green-vivid rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-md">
                <span className="text-lg sm:text-xl font-bold text-white">3</span>
              </div>
              <h3 className="font-display text-base sm:text-lg font-semibold mb-1">
                Lock In Your Recipe
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
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
