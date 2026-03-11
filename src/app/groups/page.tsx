"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Plus, Users } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useGroup } from "@/hooks/useGroup"
import type { Group } from "@/lib/supabase/types"

export default function MyGroupsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { groups, loading: groupsLoading, fetchGroups } = useGroup()
  const [localGroups, setLocalGroups] = useState<Group[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchGroups()
        .then(() => {
          setLocalGroups(groups)
        })
        .catch((err) => {
          console.error("fetchGroups error:", err)
          setError(err instanceof Error ? err.message : "Failed to fetch groups")
        })
    }
  }, [user])

  useEffect(() => {
    setLocalGroups(groups)
  }, [groups])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 shadow-sm sticky top-0">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="p-0 h-8 w-8 dark:text-gray-100">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Groups</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="grid gap-3">
          <Link href="/groups/create" className="block">
            <Button 
              className="w-full h-12 bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white font-medium dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              size="lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Group
            </Button>
          </Link>
          
          <Link href="/groups/join" className="block">
            <Button 
              className="w-full h-12 border-2 border-[#1A1A1A] text-[#1A1A1A] hover:bg-gray-50 font-medium dark:border-gray-400 dark:text-gray-100 dark:hover:bg-gray-800"
              variant="outline"
              size="lg"
            >
              <Users className="mr-2 h-4 w-4" />
              Join Group
            </Button>
          </Link>
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Your Groups</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              Error: {error}
            </div>
          )}
          {groupsLoading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          ) : localGroups.length === 0 ? (
            <Card className="py-6 dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="py-8 text-center text-gray-500 dark:text-gray-400">
                You haven&apos;t joined any groups yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {localGroups.map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  <Card className="py-6 hover:shadow-md transition-shadow cursor-pointer dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-gray-900 dark:text-white">{group.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{group.default_currency}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
