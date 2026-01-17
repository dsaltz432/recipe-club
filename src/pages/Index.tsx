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
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          {/* Left: Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6">
              Recipe Club
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-4">
              Recipe Club
            </p>
            <p className="text-lg text-gray-500 mb-8 max-w-md mx-auto lg:mx-0">
              Spin the wheel, get your ingredient, and share delicious recipes
              with your club!
            </p>
            <div className="flex justify-center lg:justify-start">
              <GoogleSignIn />
            </div>
          </div>

          {/* Right: Wheel Visualization */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-72 h-72 md:w-96 md:h-96">
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
        <div className="mt-24">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center shadow-lg">
              <div className="w-16 h-16 bg-purple rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">
                Spin the Wheel
              </h3>
              <p className="text-gray-600">
                Click the spin button and watch as the wheel selects a random
                ingredient for you.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center shadow-lg">
              <div className="w-16 h-16 bg-orange rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">
                Pick a Date
              </h3>
              <p className="text-gray-600">
                Choose when your recipe club will meet to share dishes featuring
                your ingredient.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center shadow-lg">
              <div className="w-16 h-16 bg-green rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">
                Lock In Your Recipe
              </h3>
              <p className="text-gray-600">
                Share what you'll be making and see what others in your club are
                cooking too!
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
