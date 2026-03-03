"use client"

import { AuthProvider } from "@/hooks/useAuth"
import { GroupProvider } from "@/hooks/useGroup"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <GroupProvider>
        {children}
      </GroupProvider>
    </AuthProvider>
  )
}
