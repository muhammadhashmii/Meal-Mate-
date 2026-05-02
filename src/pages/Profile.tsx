import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Mail, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchProfile = async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (data) setFullName(data.full_name || "");
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setSaving(false);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
      toast({ title: "Profile updated! ✨", description: "Your changes have been saved." });
    }
  };

  const userName = fullName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-bold">Please sign in to view your profile</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile 👤</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold rounded-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{userName}</CardTitle>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="profile-name" className="font-semibold text-foreground flex items-center gap-2">
              <User className="h-4 w-4" /> Full Name
            </Label>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="h-11 rounded-xl border-input bg-secondary/30 focus:bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email Address
            </Label>
            <Input
              value={userEmail}
              disabled
              className="h-11 rounded-xl border-input bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl font-bold"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="h-4 w-4" /> Save Changes
              </span>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
