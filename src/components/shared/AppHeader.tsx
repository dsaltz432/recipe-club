import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "@/lib/auth";
import type { User } from "@/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PantryDialog from "@/components/pantry/PantryDialog";
import { ArrowLeft, LogOut, Menu, Settings, Mail, UtensilsCrossed, Users } from "lucide-react";

interface AppHeaderProps {
  user: User | null;
  back?: { label: string; onClick: () => void };
  title: React.ReactNode;
  userIsMemberOrAdmin?: boolean;
  /** Extra content rendered in the left side of the header (e.g. desktop stats pills) */
  headerContent?: React.ReactNode;
  /** Content rendered at the top of the dropdown, hidden on md+ screens */
  dropdownHeader?: React.ReactNode;
  /** Inline styles applied to the <header> element (e.g. custom border color) */
  style?: React.CSSProperties;
}

const AppHeader = ({
  user,
  back,
  title,
  userIsMemberOrAdmin,
  headerContent,
  dropdownHeader,
  style,
}: AppHeaderProps) => {
  const navigate = useNavigate();
  const [showPantryDialog, setShowPantryDialog] = useState(false);

  return (
    <>
      <header
        className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-purple/10 shadow-sm"
        style={style}
      >
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
            {back && (
              <Button variant="ghost" size="sm" onClick={back.onClick} className="shrink-0">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{back.label}</span>
              </Button>
            )}
            {title}
            {headerContent}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2 hover:bg-purple/5 shrink-0">
                <Avatar className="h-8 w-8 ring-2 ring-purple/20">
                  <AvatarImage src={user?.avatar_url} alt={user?.name} />
                  <AvatarFallback className="bg-purple/10 text-purple font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {dropdownHeader && (
                <>
                  <div className="md:hidden">{dropdownHeader}</div>
                  <DropdownMenuSeparator className="md:hidden" />
                </>
              )}
              {userIsMemberOrAdmin && (
                <>
                  <DropdownMenuItem onClick={() => navigate("/users")} className="cursor-pointer">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => setShowPantryDialog(true)} className="cursor-pointer">
                <UtensilsCrossed className="h-4 w-4 mr-2" />
                My Pantry
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/contact")} className="cursor-pointer">
                <Mail className="h-4 w-4 mr-2" />
                Contact Us
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {user?.id && (
        <PantryDialog
          open={showPantryDialog}
          onOpenChange={setShowPantryDialog}
          userId={user.id}
        />
      )}
    </>
  );
};

export default AppHeader;
