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
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Enter Group PIN</CardTitle>
            <CardDescription>Enter the 4-digit PIN to access this group</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
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
                />
              </div>
              <Button type="submit" className="w-full" disabled={verifyingPin}>
                {verifyingPin ? "Verifying..." : "Verify PIN"}
              </Button>
              <div className="text-center">
                <Button variant="link" onClick={() => router.push("/")}>
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
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  // Calculate balances
  const balances: Record<string, number> = {}
  members.forEach(m => balances[m.id] = 0)

  expenses.forEach(expense => {
    // Add what payer paid to their balance (positive = owed money)
    balances[expense.payer_id] = (balances[expense.payer_id] || 0) + Number(expense.amount)
  })

  expenseSplits.forEach(split => {
    // Subtract what each person owes (negative = owes money)
    balances[split.member_id] = (balances[split.member_id] || 0) - Number(split.amount)
  })

  settlements.forEach(settlement => {
    // Sender paid receiver
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">{group?.name}</h1>
                <p className="text-sm text-gray-500">
                  {members.length} member{members.length !== 1 ? "s" : ""} · {getCurrencySymbol(group?.default_currency || "USD")}{totalSpent.toFixed(2)} total
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOriginalCurrency(!showOriginalCurrency)}
            >
              {showOriginalCurrency ? "Original" : "Default"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="expenses" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expenses" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Balances</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Expenses</h2>
              <Link href={`/groups/${groupId}/expense/add`}>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </Link>
            </div>

            {expenses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  No expenses yet. Add your first expense!
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(expensesByDate).map(([date, dayExpenses]) => {
                  const dayTotal = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
                  const payer = members.find(m => m.id === dayExpenses[0].payer_id)
                  
                  return (
                    <div key={date}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm text-gray-500">
                          {new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        <p className="text-sm font-medium">
                          {getCurrencySymbol(group?.default_currency || "USD")}{dayTotal.toFixed(2)}
                        </p>
                      </div>
                      <Card>
                        <CardContent className="p-0">
                          {dayExpenses.map((expense, idx) => {
                            const expensePayer = members.find(m => m.id === expense.payer_id)
                            return (
                              <div key={expense.id}>
                                <Link href={`/groups/${groupId}/expense/${expense.id}/edit`}>
                                  <div className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
                                    <div className="flex-1">
                                      <p className="font-medium">{expense.description}</p>
                                      <p className="text-sm text-gray-500">
                                        {expensePayer?.display_name || "Unknown"} paid · {expense.split_type}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold">
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
                                {idx < dayExpenses.length - 1 && <Separator />}
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
              <h2 className="text-lg font-semibold">Balances</h2>
              <Link href={`/groups/${groupId}/settle`}>
                <Button size="sm">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Pay Balance
                </Button>
              </Link>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Net Balances</CardTitle>
                <CardDescription>Positive = owed money · Negative = owes money</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {memberBalances.map(member => (
                  <div key={member.id} className="flex items-center justify-between">
                    <span>{member.display_name}</span>
                    <span className={`font-semibold ${member.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {member.balance >= 0 ? "+" : ""}{getCurrencySymbol(group?.default_currency || "USD")}{member.balance.toFixed(2)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Simplified debts view */}
            <Card>
              <CardHeader>
                <CardTitle>Who Owes Whom</CardTitle>
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
                        <span>{debtor.display_name}</span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <span>{creditor.display_name}</span>
                      </div>
                      <span className="font-semibold">
                        {getCurrencySymbol(group?.default_currency || "USD")}{amount.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Settlement History</CardTitle>
              </CardHeader>
              <CardContent>
                {settlements.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No settlements yet</p>
                ) : (
                  <div className="space-y-3">
                    {settlements.map(settlement => {
                      const sender = members.find(m => m.id === settlement.sender_id)
                      const receiver = members.find(m => m.id === settlement.receiver_id)
                      return (
                        <div key={settlement.id} className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium">{sender?.display_name}</span>
                            <span className="text-gray-500"> paid </span>
                            <span className="font-medium">{receiver?.display_name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold">
                              {getCurrencySymbol(group?.default_currency || "USD")}{Number(settlement.amount).toFixed(2)}
                            </span>
                            <p className="text-xs text-gray-500">
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
            <h2 className="text-lg font-semibold">Group Settings</h2>
            
            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>Manage group members</CardDescription>
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
                      <span>{member.display_name}</span>
                    </div>
                    {group?.owner_id && (
                      <Badge variant="outline">Member</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Group Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Default Currency</span>
                  <span className="font-medium">{group?.default_currency}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
