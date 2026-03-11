"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus, Users, Wallet, ArrowRight, Receipt, TrendingDown, ArrowLeft } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useGroup } from "@/hooks/useGroup"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrencySymbol } from "@/lib/constants"
import type { Group, GroupMember } from "@/lib/supabase/types"

export default function HomePage() {
  const { user, loading: authLoading } = useAuth()
  const { groups, loading: groupsLoading, fetchGroups } = useGroup()
  const supabase = createClient()
  const [groupsWithTotals, setGroupsWithTotals] = useState<Array<Group & { totalSpent: number, memberCount: number }>>([])

  useEffect(() => {
    if (user) {
      fetchGroups()
    }
  }, [user])

  useEffect(() => {
    const fetchGroupTotals = async () => {
      if (!groups.length) return

      const groupsWithData = await Promise.all(
        groups.map(async (group) => {
          const [expensesRes, membersRes] = await Promise.all([
            supabase.from("expenses").select("amount, currency").eq("group_id", group.id),
            supabase.from("group_members").select("id").eq("group_id", group.id),
          ])

          const totalSpent = (expensesRes.data || []).reduce((sum: number, e: { amount: number }) => {
            return sum + Number(e.amount)
          }, 0)

          return {
            ...group,
            totalSpent,
            memberCount: (membersRes.data || []).length,
          }
        })
      )

      setGroupsWithTotals(groupsWithData)
    }

    fetchGroupTotals()
  }, [groups, supabase])

  const isLoggedIn = !!user

  // If logged in and has groups, show the groups directly
  if (isLoggedIn && groupsWithTotals.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <main className="max-w-md mx-auto px-4 py-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <Image src="/logo.png" alt="Splitato" width={80} height={80} className="h-20 w-20" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Split Expenses Easily
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Track and split expenses with your travel group. No more confusion about who owes whom.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">My Groups</h3>
            {groupsWithTotals.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <Card className="py-3 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{group.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {group.memberCount} member{group.memberCount !== 1 ? "s" : ""} · {getCurrencySymbol(group.default_currency)}{group.totalSpent.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {new Date(group.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid gap-3 pt-2">
            <Link href="/groups/create" className="block">
              <Button 
                className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white font-medium text-base dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                size="lg"
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Group
              </Button>
            </Link>
            
            <Link href="/groups/join" className="block">
              <Button 
                className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white font-medium text-base dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                size="lg"
              >
                <Users className="mr-2 h-5 w-5" />
                Join Group
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // Show landing page for logged out users or logged in users with no groups
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {!isLoggedIn && (
          <>
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <img src="/logo.png" alt="Splitato" className="h-20 w-20" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Split Expenses Easily
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Track and split expenses with your travel group. No more confusion about who owes whom.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
                <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white dark:text-gray-900">1</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Create or Join a Group</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Start a new trip group or join an existing one with a group code</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
                <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0">
                  <Receipt className="h-4 w-4 text-white dark:text-gray-900" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Add Expenses</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Record what you paid for and split it evenly or custom</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
                <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="h-4 w-4 text-white dark:text-gray-900" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Settle Up</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">See who owes whom and record payments to settle up</p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="grid gap-3 pt-2">
          <Link href="/groups/create" className="block">
            <Button 
              className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white font-medium text-base dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Group
            </Button>
          </Link>
          
          <Link href="/groups/join" className="block">
            <Button 
              className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white font-medium text-base dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              size="lg"
            >
              <Users className="mr-2 h-5 w-5" />
              Join Group
            </Button>
          </Link>
          
          {!isLoggedIn && (
            <Link href="/groups" className="block">
              <Button 
                className="w-full h-14 border-2 border-gray-900 text-gray-900 hover:bg-gray-50 font-medium text-base dark:border-white dark:text-white dark:hover:bg-gray-800"
                variant="outline"
                size="lg"
              >
                <Wallet className="mr-2 h-5 w-5" />
                My Groups
              </Button>
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
