"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2">
            <span className="text-2xl font-semibold tracking-tight text-sage-200">
              Frazier
            </span>
            <span className="ml-1.5 text-2xl font-light tracking-tight text-muted-foreground">
              CRM
            </span>
          </div>
          <CardDescription>Sign in to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
