"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import LoginForm from "@/components/login-form"

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, isInitialized } = useAuth()

  useEffect(() => {
    // Small delay to ensure auth context has time to update
    const timer = setTimeout(() => {
      if (isInitialized && isAuthenticated) {
        console.log("[v0] User authenticated, redirecting to dashboard...")
        router.push("/dashboard")
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isAuthenticated, isInitialized, router])

  // Show loading state while checking auth
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">PedalUp</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return <LoginForm />
}
