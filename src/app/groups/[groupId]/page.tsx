"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Plus, 
  DollarSign, 
  Users, 
  Settings, 
  Receipt, 
  Wallet,
  ArrowRight
} from "lucide-react"
import { toast } from "sonner"
import { useGroup } from "@/hooks/useGroup"
import { getCurrencySymbol } from "@/lib/constants"
import type { Group, GroupMember, Expense, ExpenseSplit, Settlement } from "@/lib/supabase/types"

export default function GroupDashboardPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { verifyPin, isPinVerified, clearPinVerification } = useGroup()

  const [loading, setLoading] = useState(true)
  const [verifyingPin, setVerifyingPin] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [expenseSplits, setExpenseSplits] = useState<ExpenseSplit[]>([])
  const [showOriginalCurrency, setShowOriginalCurrency] = useState(false)

  useEffect(() => {
    if (isPinVerified(groupId)) {
      fetchGroupData()
    } else {
      setLoading(false)
    }
  }, [groupId, isPinVerified])

  const fetchGroupData = async () => {
    setLoading(true)
    const [groupRes, membersRes, expensesRes, settlementsRes, splitsRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("group_members").select("*").eq("group_id", groupId),
      supabase.from("expenses").select("*").eq("group_id", groupId).order("date", { ascending: false }),
      supabase.from("settlements").select("*").eq("group_id", groupId).order("date", { ascending: false }),
      supabase.from("expense_splits").select("*")
    ])

    setGroup(groupRes.data)
    setMembers(membersRes.data || [])
    setExpenses(expensesRes.data || [])
    setSettlements(settlementsRes.data || [])
    setExpenseSplits(splitsRes.data || [])
    setLoading(false)
  }

  const handlePinVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyingPin(true)

    const isValid = await verifyPin(groupId, pinInput)
    if (isValid) {
      toast.success("PIN verified")
      fetchGroupData()
    } else {
      toast.error("Invalid PIN")
    }
    setVerifyingPin(false)
  }

  if (!isPinVerified(groupId)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Enter Group PIN</CardTitle>
            <CardDescription className="dark:text-gray-400">Enter the 4-digit PIN to access this group</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin" className="text-gray-900 dark:text-white">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="Enter 4-digit PIN"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                  autoFocus
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-400"
                />
              </div>
              <Button type="submit" className="w-full bg-[#1A1A1A] hover:bg-[#2D2D2D] dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200" disabled={verifyingPin}>
                {verifyingPin ? "Verifying..." : "Verify PIN"}
              </Button>
              <div className="text-center">
                <Button variant="link" onClick={() => router.push("/")} className="dark:text-gray-300">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  // Calculate balances
  const balances: Record<string, number> = {}
  members.forEach(m => balances[m.id] = 0)

  expenses.forEach(expense => {
    balances[expense.payer_id] = (balances[expense.payer_id] || 0) + Number(expense.amount)
  })

  expenseSplits.forEach(split => {
    balances[split.member_id] = (balances[split.member_id] || 0) - Number(split.amount)
  })

  settlements.forEach(settlement => {
    balances[settlement.sender_id] = (balances[settlement.sender_id] || 0) - Number(settlement.amount)
    balances[settlement.receiver_id] = (balances[settlement.receiver_id] || 0) + Number(settlement.amount)
  })

  const memberBalances = members.map(m => ({
    ...m,
    balance: balances[m.id] || 0
  }))

  // Group expenses by date
  const expensesByDate = expenses.reduce((acc, expense) => {
    const date = expense.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(expense)
    return acc
  }, {} as Record<string, Expense[]>)

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <header className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/groups">
                <Button variant="ghost" size="sm" className="p-0 h-8 w-8 dark:text-gray-100">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{group?.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {members.length} member{members.length !== 1 ? "s" : ""} · {getCurrencySymbol(group?.default_currency || "USD")}{totalSpent.toFixed(2)} total
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {group?.group_code && (
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  {group.group_code}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOriginalCurrency(!showOriginalCurrency)}
                className="dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200"
              >
                {showOriginalCurrency ? "Original" : "Default"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="expenses" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-800">
            <TabsTrigger value="expenses" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Balances</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Expenses</h2>
              <Link href={`/groups/${groupId}/expense/add`}>
                <Button size="sm" className="bg-[#1A1A1A] hover:bg-[#2D2D2D] dark:bg-white dark:text-gray-900">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </Link>
            </div>

            {expenses.length === 0 ? (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="py-12 text-center">
                  <Receipt className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-gray-900 dark:text-white font-medium">No expenses yet</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Add your first expense!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(expensesByDate).map(([date, dayExpenses]) => {
                  const dayTotal = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
                  
                  return (
                    <div key={date}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm text-gray-500 dark:text-gray-400">
                          {new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {getCurrencySymbol(group?.default_currency || "USD")}{dayTotal.toFixed(2)}
                        </p>
                      </div>
                      <Card className="dark:bg-gray-800 dark:border-gray-700">
                        <CardContent className="p-0">
                          {dayExpenses.map((expense, idx) => {
                            const expensePayer = members.find(m => m.id === expense.payer_id)
                            return (
                              <div key={expense.id}>
                                <Link href={`/groups/${groupId}/expense/${expense.id}/edit`}>
                                  <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900 dark:text-white">{expense.description}</p>
                                      <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {expensePayer?.display_name || "Unknown"} paid · {expense.split_type}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-gray-900 dark:text-white">
                                        {getCurrencySymbol(showOriginalCurrency ? expense.currency : group?.default_currency || "USD")}
                                        {Number(expense.amount).toFixed(2)}
                                        {showOriginalCurrency && expense.currency !== group?.default_currency && (
                                          <span className="text-xs text-gray-500 ml-1">({expense.currency})</span>
                                        )}
                                      </p>
                                      {expense.receipt_url && (
                                        <Badge variant="secondary" className="text-xs">Receipt</Badge>
                                      )}
                                    </div>
                                  </div>
                                </Link>
                                {idx < dayExpenses.length - 1 && <Separator className="dark:border-gray-700" />}
                              </div>
                            )
                          })}
                        </CardContent>
                      </Card>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="balances" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Balances</h2>
              <Link href={`/groups/${groupId}/settle`}>
                <Button size="sm" className="bg-[#1A1A1A] hover:bg-[#2D2D2D] dark:bg-white dark:text-gray-900">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Pay Balance
                </Button>
              </Link>
            </div>

            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Net Balances</CardTitle>
                <CardDescription className="dark:text-gray-400">Positive = owed money · Negative = owes money</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {memberBalances.map(member => (
                  <div key={member.id} className="flex items-center justify-between">
                    <span className="text-gray-900 dark:text-white">{member.display_name}</span>
                    <span className={`font-semibold ${member.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {member.balance >= 0 ? "+" : ""}{getCurrencySymbol(group?.default_currency || "USD")}{member.balance.toFixed(2)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Simplified debts view */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Who Owes Whom</CardTitle>
              </CardHeader>
              <CardContent>
                {memberBalances.filter(m => m.balance < -0.01).map(debtor => {
                  const creditor = memberBalances.find(m => m.balance > 0.01)
                  if (!creditor) return null
                  
                  const amount = Math.min(Math.abs(debtor.balance), creditor.balance)
                  if (amount < 0.01) return null
                  
                  return (
                    <div key={`${debtor.id}-${creditor.id}`} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 dark:text-white">{debtor.display_name}</span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{creditor.display_name}</span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {getCurrencySymbol(group?.default_currency || "USD")}{amount.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Settlement History</CardTitle>
              </CardHeader>
              <CardContent>
                {settlements.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No settlements yet</p>
                ) : (
                  <div className="space-y-3">
                    {settlements.map(settlement => {
                      const sender = members.find(m => m.id === settlement.sender_id)
                      const receiver = members.find(m => m.id === settlement.receiver_id)
                      return (
                        <div key={settlement.id} className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium text-gray-900 dark:text-white">{sender?.display_name}</span>
                            <span className="text-gray-500 dark:text-gray-400"> paid </span>
                            <span className="font-medium text-gray-900 dark:text-white">{receiver?.display_name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {getCurrencySymbol(group?.default_currency || "USD")}{Number(settlement.amount).toFixed(2)}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(settlement.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Group Settings</h2>
            
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Members</CardTitle>
                <CardDescription className="dark:text-gray-400">Manage group members</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map(member => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {member.display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-gray-900 dark:text-white">{member.display_name}</span>
                    </div>
                    {group?.owner_id && (
                      <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">Member</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Group Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Default Currency</span>
                  <span className="font-medium text-gray-900 dark:text-white">{group?.default_currency}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
