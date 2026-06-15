import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/Brand";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — NoteForge AI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: "/dashboard" });
    });
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fn = mode === "sign_in" ? supabase.auth.signInWithPassword({ email, password }) : supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      const { error } = await fn;
      if (error) throw error;
      toast.success(mode === "sign_in" ? "Welcome back" : "Account created");
      nav({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-background to-muted/30 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <h1 className="text-xl font-semibold">{mode === "sign_in" ? "Sign in" : "Create account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "sign_in" ? "Welcome back to NoteForge AI." : "Start summarizing your notes in seconds."}
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "sign_in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"))}
        >
          {mode === "sign_in" ? "No account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
