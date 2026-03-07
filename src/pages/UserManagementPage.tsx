import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, getAllowedUser, isMemberOrAdmin } from "@/lib/auth";
import type { User } from "@/types";
import AppHeader from "@/components/shared/AppHeader";
import UserManagement from "@/components/admin/UserManagement";

const UserManagementPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userCanManage, setUserCanManage] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser?.email) {
        const allowed = await getAllowedUser(currentUser.email);
        setUserCanManage(isMemberOrAdmin(allowed));

        // Redirect viewers back to dashboard
        if (!isMemberOrAdmin(allowed)) {
          navigate("/dashboard");
        }
      } else {
        navigate("/");
      }

      setIsLoading(false);
    };

    loadUser();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  if (!userCanManage) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-light/30 via-white to-orange-light/30">
      <AppHeader
        user={user}
        userIsMemberOrAdmin={userCanManage}
        back={{ label: "Back", onClick: () => window.history.state?.idx > 0 ? navigate(-1) : navigate("/dashboard") }}
        title={
          <h1 className="font-display text-lg sm:text-2xl font-bold text-gray-900 truncate">
            User Management
          </h1>
        }
      />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <UserManagement currentUserEmail={user?.email || ""} />
      </main>
    </div>
  );
};

export default UserManagementPage;
