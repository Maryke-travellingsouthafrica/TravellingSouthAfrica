
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, signInWithGoogle, sendPasswordReset } from "@/firebase/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { AccessibleDialogContent } from "@/components/ui/AccessibleDialogContent";
import { DialogFooter } from "@/components/ui/dialog";
import { Translatable } from "@/components/translatable";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/logo";
import { Eye, EyeOff } from "lucide-react";

// Where to send the user after login: the same-site path in ?redirect= if
// one was given (e.g. from a "Login Required" card), otherwise the dashboard.
function getPostLoginPath() {
  const redirect = new URLSearchParams(window.location.search).get("redirect");
  const isSameSitePath = !!redirect && redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.startsWith("/\\");
  return isSameSitePath ? redirect : "/dashboard";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await login(email, password);
    if (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
    } else {
      router.push(getPostLoginPath());
    }
  };
  
  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if(error) {
        toast({
            variant: "destructive",
            title: "Google Sign-In Failed",
            description: error.message,
        });
    } else {
        router.push(getPostLoginPath());
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await sendPasswordReset(resetEmail);
    if (error) {
      toast({
        variant: "destructive",
        title: "Password Reset Failed",
        description: "Could not send reset email. Please check the address and try again.",
      });
    } else {
      toast({
        title: "Password reset email sent!",
        description: "Check your inbox for a link to reset your password.",
      });
      setIsResetDialogOpen(false);
      setResetEmail("");
    }
  };

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <Card className="mx-auto max-w-sm">
          <CardHeader className="text-center">
            <Link href="/"><Logo className="mx-auto w-40" priority /></Link>
            <CardTitle className="text-2xl"><Translatable text="Login" /></CardTitle>
            <CardDescription>
              <Translatable text="Enter your email below to login to your account" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email"><Translatable text="Email" /></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password"><Translatable text="Password" /></Label>
                  <button
                    type="button"
                    onClick={() => setIsResetDialogOpen(true)}
                    className="ml-auto inline-block text-sm underline"
                  >
                    <Translatable text="Forgot your password?" />
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full">
                <Translatable text="Login" />
              </Button>
            </form>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                      <Translatable text="Or continue with" />
                  </span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.417 9.564C34.645 6.137 29.625 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691c-1.566 2.91-2.454 6.234-2.454 9.809c0 3.575.888 6.899 2.454 9.809l-5.464 4.25C1.189 34.288 0 29.358 0 24c0-5.358 1.189-10.288 3.065-14.56L6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 48c5.645 0 10.675-1.855 14.389-4.955l-5.464-4.25c-1.897 1.34-4.286 2.115-6.925 2.115c-5.223 0-9.657-3.343-11.303-7.886l-5.464 4.25C6.935 43.145 14.935 48 24 48z"/>
                <path fill="#1976D2" d="M43.611 20.083L43.595 20L42 20H24v8h11.303c-0.792 2.237-2.103 4.14-3.87 5.574l5.464 4.25C40.637 34.375 44 28.75 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              <Translatable text="Google" />
            </Button>
            <div className="mt-4 text-center text-sm">
              <Translatable text="Don't have an account?" />{" "}
              <Link href="/signup" className="underline">
                <Translatable text="Sign up" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AccessibleDialogContent
          title="Reset Password"
          description="Enter your email to reset your password."
          className="sm:max-w-md"
        >
          <form onSubmit={handlePasswordReset}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reset-email">
                  <Translatable text="Email Address" />
                </Label>
                <Input
                  id="reset-email"
                  placeholder="Enter your email to reset password"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
               <DialogClose asChild>
                <Button type="button" variant="secondary">
                  <Translatable text="Cancel" />
                </Button>
              </DialogClose>
              <Button type="submit"><Translatable text="Send Reset Link" /></Button>
            </DialogFooter>
          </form>
        </AccessibleDialogContent>
      </Dialog>
    </>
  );
}
