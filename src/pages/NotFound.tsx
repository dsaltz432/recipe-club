import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-light via-white to-orange-light">
      <div className="text-center">
        <h1 className="font-display text-6xl font-bold text-gray-900 mb-4">
          404
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Oops! This page doesn't exist.
        </p>
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
