import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Trash2, Users, Crown, Eye, ChefHat } from "lucide-react";

interface AllowedUser {
  id: string;
  email: string;
  role: "admin" | "viewer";
  is_club_member: boolean;
  created_at: string;
}

interface UserManagementProps {
  currentUserEmail: string;
}

const UserManagement = ({ currentUserEmail }: UserManagementProps) => {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AllowedUser | null>(null);

  // Add user form state
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [newIsClubMember, setNewIsClubMember] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("allowed_users")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setUsers(
        (data || []).map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role as "admin" | "viewer",
          is_club_member: u.is_club_member,
          created_at: u.created_at,
        }))
      );
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async () => {
    const email = newEmail.trim().toLowerCase();

    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (users.some((u) => u.email.toLowerCase() === email)) {
      toast.error("This user has already been invited");
      return;
    }

    setIsAdding(true);
    try {
      const { data: session } = await supabase.auth.getSession();

      const { error } = await supabase.from("allowed_users").insert({
        email,
        role: newRole,
        is_club_member: newIsClubMember,
        invited_by: session.session?.user.id,
      });

      if (error) throw error;

      toast.success(`Invited ${email}`);
      setShowAddDialog(false);
      setNewEmail("");
      setNewRole("viewer");
      setNewIsClubMember(true);
      loadUsers();
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error("Failed to invite user");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (userToDelete.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      toast.error("You cannot remove yourself");
      setUserToDelete(null);
      return;
    }

    try {
      const { error } = await supabase
        .from("allowed_users")
        .delete()
        .eq("id", userToDelete.id);

      if (error) throw error;

      toast.success(`Removed ${userToDelete.email}`);
      setUserToDelete(null);
      loadUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to remove user");
    }
  };

  const handleUpdateRole = async (user: AllowedUser, newRole: "admin" | "viewer") => {
    if (user.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      toast.error("You cannot change your own role");
      return;
    }

    try {
      const { error } = await supabase
        .from("allowed_users")
        .update({ role: newRole })
        .eq("id", user.id);

      if (error) throw error;

      toast.success(`Updated ${user.email} to ${newRole}`);
      loadUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const handleToggleClubMember = async (user: AllowedUser) => {
    try {
      const { error } = await supabase
        .from("allowed_users")
        .update({ is_club_member: !user.is_club_member })
        .eq("id", user.id);

      if (error) throw error;

      toast.success(
        user.is_club_member
          ? `Removed ${user.email} from club`
          : `Added ${user.email} to club`
      );
      loadUsers();
    } catch (error) {
      console.error("Error toggling club member:", error);
      toast.error("Failed to update club membership");
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
        </CardContent>
      </Card>
    );
  }

  const admins = users.filter((u) => u.role === "admin");
  const viewers = users.filter((u) => u.role === "viewer");
  const clubMembers = users.filter((u) => u.is_club_member);

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-2xl flex items-center gap-2">
                <Users className="h-6 w-6" />
                User Management
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {admins.length} admin{admins.length !== 1 ? "s" : ""} · {viewers.length} viewer{viewers.length !== 1 ? "s" : ""} · {clubMembers.length} club member{clubMembers.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-purple hover:bg-purple-dark"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-white"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      user.role === "admin" ? "bg-purple/20" : "bg-gray-100"
                    }`}
                  >
                    {user.role === "admin" ? (
                      <Crown className="h-5 w-5 text-purple" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.email}</span>
                      {user.email.toLowerCase() === currentUserEmail.toLowerCase() && (
                        <span className="text-xs bg-purple/10 text-purple px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                      {user.is_club_member && (
                        <span className="text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ChefHat className="h-3 w-3" />
                          Club Member
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground capitalize">
                      {user.role}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Club Member Toggle */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`club-${user.id}`} className="text-sm text-muted-foreground">
                      In Club
                    </Label>
                    <Switch
                      id={`club-${user.id}`}
                      checked={user.is_club_member}
                      onCheckedChange={() => handleToggleClubMember(user)}
                    />
                  </div>

                  {/* Role Select */}
                  <Select
                    value={user.role}
                    onValueChange={(value: "admin" | "viewer") =>
                      handleUpdateRole(user, value)
                    }
                    disabled={user.email.toLowerCase() === currentUserEmail.toLowerCase()}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setUserToDelete(user)}
                    disabled={user.email.toLowerCase() === currentUserEmail.toLowerCase()}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No users yet. Invite someone to get started!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Add a new user who can access Recipe Club Hub.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newRole} onValueChange={(v: "admin" | "viewer") => setNewRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Viewer - Can view events and add recipes
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Admin - Full access to manage everything
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="club-member">Include in Club</Label>
                <p className="text-sm text-muted-foreground">
                  Club members participate in events and receive calendar invites
                </p>
              </div>
              <Switch
                id="club-member"
                checked={newIsClubMember}
                onCheckedChange={setNewIsClubMember}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={isAdding || !newEmail.trim()}
              className="bg-purple hover:bg-purple-dark"
            >
              {isAdding ? "Inviting..." : "Invite User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToDelete?.email}? They will no longer be able to access Recipe Club Hub.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;
