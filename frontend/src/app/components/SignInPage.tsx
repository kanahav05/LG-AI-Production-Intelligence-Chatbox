import { useState } from "react";
import { useNavigate } from "react-router";
import { Lock, User } from "lucide-react";

export function SignInPage() {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeId && password) {
      localStorage.setItem("lg-auth", "true");
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20 dark:opacity-10"
        style={{
          background: "var(--gradient-warm)",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                 style={{ background: "var(--lg-red)" }}>
              <span className="text-3xl font-bold text-white">LG</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Production Intelligence</h1>
            <p className="text-muted-foreground mt-2">Sign in to continue</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <label className="block mb-2 text-sm text-foreground">Employee ID</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Enter your Employee ID"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Enter your Password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-lg text-white font-medium transition-all hover:opacity-90 shadow-lg"
              style={{ background: "var(--gradient-warm)" }}
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Forgot password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
