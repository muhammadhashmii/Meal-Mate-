import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, UtensilsCrossed } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SignUp = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrimmed = email.trim();

    if (!emailTrimmed.toLowerCase().endsWith("@isb.nu.edu.pk")) {
      toast({
        title: "Invalid email domain",
        description: "Please use your university email (@isb.nu.edu.pk).",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await signUp(emailTrimmed, password, fullName);
    setLoading(false);

    if (error) {
      const isRateLimited = /rate limit/i.test(error.message || "");
      toast({
        title: isRateLimited ? "Too many attempts" : "Sign up failed",
        description: isRateLimited
          ? "Email sending is temporarily rate-limited. Please wait a few minutes and try again."
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account created! 🎉",
        description:
          "If login says 'Invalid credentials', you likely need to confirm the email first.",
      });
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Floating food emojis */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <span className="absolute top-[8%] right-[10%] text-4xl animate-float opacity-30">🍛</span>
        <span className="absolute top-[30%] left-[6%] text-3xl animate-float opacity-25" style={{ animationDelay: "0.7s" }}>🥤</span>
        <span className="absolute bottom-[20%] right-[15%] text-3xl animate-float opacity-20" style={{ animationDelay: "1.2s" }}>🍰</span>
        <span className="absolute bottom-[10%] left-[10%] text-4xl animate-float opacity-25" style={{ animationDelay: "1.8s" }}>🍊</span>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <UtensilsCrossed className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Join MealMate! 🍊</h1>
          <p className="text-muted-foreground mt-2">Create your account to start ordering</p>
        </div>

        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-foreground font-semibold">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Ahmed Khan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-12 rounded-xl border-input bg-secondary/30 focus:bg-card transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-semibold">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@isb.nu.edu.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl border-input bg-secondary/30 focus:bg-card transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-semibold">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 rounded-xl border-input bg-secondary/30 focus:bg-card transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground font-semibold">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl border-input bg-secondary/30 focus:bg-card transition-colors"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base shadow-lg hover:shadow-xl transition-all mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  "Create Account 🎉"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-bold hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          MealMate — Your campus cafeteria companion 🧡
        </p>
      </div>
    </div>
  );
};

export default SignUp;
