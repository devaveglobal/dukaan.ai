"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, Lock, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { checkEmailFlow, completeFirstTimePassword } from "@/actions/auth";

type LoginStep = "email" | "password" | "otp" | "setup-password";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const normalizedEmail = email.trim().toLowerCase();
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ── Step 1: determine which flow this email needs ──────────────────────────
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await checkEmailFlow(normalizedEmail);

      if (result.flow === "not-found") {
        // Still allow password attempt — user may exist but listUsers missed them
        setStep("password");
        return;
      }

      if (result.flow === "password") {
        // Returning user — just show password field
        setStep("password");
        return;
      }

      // flow === "otp-first-time": invited user, no password yet
      // User is guaranteed to exist + be confirmed at this point (server action handled it)
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw new Error(error.message);

      toast.success("OTP sent! Check your email for a 6-digit code.");
      setStep("otp");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2a: returning user — normal password login ────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      const role = data.user?.user_metadata?.role;
      router.push(role === "admin" ? "/admin/chat" : "/chat");
      router.refresh();
    }
  };

  // ── Step 2b: first-time user — verify OTP ─────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: otp, type: "email" });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success("Email verified! Now set your password.");
      setStep("setup-password");
      setLoading(false);
    }
  };

  // ── Step 3: first-time user — set password ────────────────────────────────
  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setLoading(true);
    try {
      const result = await completeFirstTimePassword(newPassword, normalizedEmail);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: newPassword,
      });
      if (error) throw new Error(error.message);

      toast.success("Password set! Redirecting...");
      const role = data.user?.user_metadata?.role ?? result.role;
      window.location.assign(role === "admin" ? "/admin/chat" : "/chat");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to set password");
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw new Error(error.message);
      toast.success("New code sent!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden">
      <CardHeader className="space-y-1 bg-primary/5 pb-8">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-3xl font-bold tracking-tight">
          {step === "email" && "Welcome"}
          {step === "password" && "Welcome Back"}
          {step === "otp" && "Verify Email"}
          {step === "setup-password" && "Set Your Password"}
        </CardTitle>
        <CardDescription className="text-base">
          {step === "email" && "Enter your email to continue."}
          {step === "password" && "Enter your password to sign in."}
          {step === "otp" && `We sent a 6-digit code to ${email}`}
          {step === "setup-password" && "Create a password for your new account."}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        {step === "email" && (
          <form onSubmit={handleCheckEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" /> Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold group" disabled={loading}>
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <> Continue <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /> </>
              }
            </Button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password-login" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" /> Password
              </Label>
              <Input
                id="password-login"
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("email")}>
              Use a different email
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp" className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-muted-foreground" /> 6-Digit Code
              </Label>
              <Input
                id="otp"
                placeholder="000000"
                maxLength={6}
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading || otp.length !== 6}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Code"}
            </Button>
            <Button type="button" variant="ghost" className="w-full text-sm" disabled={loading} onClick={handleResendOtp}>
              Resend code
            </Button>
          </form>
        )}

        {step === "setup-password" && (
          <form onSubmit={handleSetupPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" /> New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                required
                autoFocus
                minLength={6}
                placeholder="Min. 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" /> Confirm Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12"
              />
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-destructive">Passwords do not match.</p>
            )}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={loading || newPassword !== confirmPassword || newPassword.length < 6}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Set Password & Continue"}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="bg-muted/30 py-4 flex justify-center border-t border-muted/50">
        <p className="text-sm text-muted-foreground">Authorized Access Only</p>
      </CardFooter>
    </Card>
  );
}
