"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { ThemeToggle } from "@/components/theme-toggle"

export function Header() {
  const { user } = useAuth()

  return (
    <header className="bg-white border-b shadow-sm sticky top-0 z-50 dark:bg-gray-900 dark:border-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Splitato</h1>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="outline" size="sm" className="dark:border-gray-600 dark:hover:bg-gray-800">
              {user ? "Account" : "Sign Up / Login"}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
