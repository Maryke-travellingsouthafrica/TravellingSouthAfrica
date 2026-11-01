"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signup, signInWithGoogle } from "@/firebase/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Translatable } from "@/components/translatable";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/logo";
import { getPostAuthPath, getRedirectFromSearch, withRedirect } from "@/lib/auth-redirect";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Read after mount because the page is prerendered, where there is no query string.
  const [loginHref, setLoginHref] = useState("/login");
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setLoginHref(withRedirect("/login", getRedirectFromSearch(window.location.search)));
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signup(name, email, password);
    if (error) {
      toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: error.message,
      });
    } else {
      router.push(getPostAuthPath(window.location.search));
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
        router.push(getPostAuthPath(window.location.search));
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="mx-auto max-w-sm">
        <CardHeader className="text-center">
            <Link href="/"><Logo className="mx-auto w-40" priority /></Link>
            <CardTitle className="text-2xl"><Translatable text="Sign Up" /></CardTitle>
          <CardDescription>
            <Translatable text="Enter your information to create an account" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full-name"><Translatable text="Full name" /></Label>
              <Input 
                id="full-name" 
                placeholder="John Doe" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
              <Label htmlFor="password"><Translatable text="Password" /></Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            <Button type="submit" className="w-full">
              <Translatable text="Create an account" />
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
            <Translatable text="Already have an account?" />{" "}
            <Link href={loginHref} className="underline">
              <Translatable text="Login" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
