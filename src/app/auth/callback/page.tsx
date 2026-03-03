"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState("Verifying...")

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        setStatus("Error: " + error.message)
        return
      }

      if (data.session) {
        setStatus("Success! Redirecting...")
        router.push("/")
        router.refresh()
      } else {
        // Check if this is from email confirmation
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setStatus("Email confirmed! Redirecting...")
          router.push("/")
          router.refresh()
        } else {
          setStatus("Please check your email to confirm your account")
        }
      }
    }

    handleEmailConfirmation()
  }, [supabase, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg">{status}</p>
      </div>
    </div>
  )
}
