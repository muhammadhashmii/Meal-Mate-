import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, UtensilsCrossed } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);

    if (error) {
      const msg = String(error.message ?? "");
      const looksLikeUnconfirmed =
        /invalid login credentials/i.test(msg) ||
        /invalid credentials/i.test(msg);
      toast({
        title: "Login failed",
        description: looksLikeUnconfirmed
          ? "If you just signed up, you may need to confirm your email before you can sign in."
          : msg,
        variant: "destructive",
      });
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Floating food emojis */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <span className="absolute top-[10%] left-[8%] text-4xl animate-float opacity-30">🍔</span>
        <span className="absolute top-[20%] right-[12%] text-3xl animate-float opacity-25" style={{ animationDelay: "1s" }}>🍕</span>
        <span className="absolute bottom-[15%] left-[15%] text-3xl animate-float opacity-20" style={{ animationDelay: "0.5s" }}>🧁</span>
        <span className="absolute bottom-[25%] right-[8%] text-4xl animate-float opacity-25" style={{ animationDelay: "1.5s" }}>🍊</span>
        <span className="absolute top-[50%] left-[5%] text-2xl animate-float opacity-20" style={{ animationDelay: "2s" }}>☕</span>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <UtensilsCrossed className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Welcome Back! 🍽️</h1>
          <p className="text-muted-foreground mt-2">Sign in to order your favorite meals</p>
        </div>

        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
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
                    placeholder="Enter your password"
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base shadow-lg hover:shadow-xl transition-all"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In 🍊"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary font-bold hover:underline">
                  Sign Up
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

export default Login;
