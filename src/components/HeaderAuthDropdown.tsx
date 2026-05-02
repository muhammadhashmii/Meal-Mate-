import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Settings, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AuthDialog = "login" | "signup" | null;

export function HeaderAuthDropdown() {
  const { user, signIn, signUp, signOut } = useAuth();
  const { clearCart } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [authDialog, setAuthDialog] = useState<AuthDialog>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFullName("");
    setShowPassword(false);
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      setAuthDialog(null);
      resetForm();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.endsWith("@isb.nu.edu.pk")) {
      toast({ title: "Invalid email domain", description: "Please use your @isb.nu.edu.pk email.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Min 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome to MealMate! 💛", description: "Your account is ready. You can now sign in." });
      setAuthDialog("login");
      setPassword("");
      setConfirmPassword("");
    }
  };

  const handleSignOut = async () => {
    clearCart();
    resetForm();
    await signOut();
    toast({ title: "Signed out 👋", description: "You've been signed out safely." });
    navigate("/");
  };

  if (user) {
    const initials = (user.user_metadata?.full_name || user.email || "U")
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 gap-2 rounded-full pl-1 pr-3 hover:bg-secondary">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">{initials}</AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl">
          <div className="px-2 py-1.5 text-sm">
            <p className="font-semibold text-foreground">{user.user_metadata?.full_name || "Student"}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer rounded-lg">
            <Settings className="mr-2 h-4 w-4" />
            Profile Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer rounded-lg text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-10 gap-2 rounded-full">
            <User className="h-4 w-4" />
            Account
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem onClick={() => { resetForm(); setAuthDialog("login"); }} className="cursor-pointer rounded-lg">
            Sign In
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { resetForm(); setAuthDialog("signup"); }} className="cursor-pointer rounded-lg">
            Sign Up
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={authDialog !== null} onOpenChange={(open) => { if (!open) { setAuthDialog(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              {authDialog === "login" && "Welcome Back! 🍽️"}
              {authDialog === "signup" && "Join MealMate! 🍊"}
            </DialogTitle>
            <p className="text-center text-muted-foreground text-sm">
              {authDialog === "login" && "Sign in to order your favorite meals"}
              {authDialog === "signup" && "Create your account to start ordering"}
            </p>
          </DialogHeader>

          {authDialog === "login" && (
            <form onSubmit={handleLogin} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="font-semibold text-foreground">Email</Label>
                <Input id="login-email" type="email" placeholder="you@isb.nu.edu.pk" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-xl border-input bg-secondary/30 focus:bg-card" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="font-semibold text-foreground">Password</Label>
                <div className="relative">
                  <Input id="login-password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 rounded-xl border-input bg-secondary/30 focus:bg-card pr-12" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-bold">
                {loading ? "Signing in..." : "Sign In 🍊"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button type="button" onClick={() => { resetForm(); setAuthDialog("signup"); }} className="text-primary font-bold hover:underline">Sign Up</button>
              </p>
            </form>
          )}

          {authDialog === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="font-semibold text-foreground">Full Name</Label>
                <Input id="signup-name" type="text" placeholder="Ahmed Khan" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-11 rounded-xl border-input bg-secondary/30 focus:bg-card" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="font-semibold text-foreground">Email</Label>
                <Input id="signup-email" type="email" placeholder="you@isb.nu.edu.pk" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-xl border-input bg-secondary/30 focus:bg-card" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="font-semibold text-foreground">Password</Label>
                <div className="relative">
                  <Input id="signup-password" type={showPassword ? "text" : "password"} placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 rounded-xl border-input bg-secondary/30 focus:bg-card pr-12" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm" className="font-semibold text-foreground">Confirm Password</Label>
                <Input id="signup-confirm" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-11 rounded-xl border-input bg-secondary/30 focus:bg-card" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-bold">
                {loading ? "Creating account..." : "Create Account 🎉"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button type="button" onClick={() => { resetForm(); setAuthDialog("login"); }} className="text-primary font-bold hover:underline">Sign In</button>
              </p>
            </form>
          )}

        </DialogContent>
      </Dialog>
    </>
  );
}
