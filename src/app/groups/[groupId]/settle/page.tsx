"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { getCurrencySymbol } from "@/lib/constants"
import type { Group, GroupMember, Expense, ExpenseSplit, Settlement } from "@/lib/supabase/types"

const settlementSchema = z.object({
  receiverId: z.string().min(1, "Receiver is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
})

type SettlementFormData = z.infer<typeof settlementSchema>

export default function PayBalancePage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expenseSplits, setExpenseSplits] = useState<ExpenseSplit[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(settlementSchema),
    defaultValues: {
      receiverId: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
    },
  })

  const watchReceiverId = watch("receiverId")
  const watchAmount = watch("amount")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)

    const [groupRes, membersRes, expensesRes, splitsRes, settlementsRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("group_members").select("*").eq("group_id", groupId),
      supabase.from("expenses").select("*").eq("group_id", groupId),
      supabase.from("expense_splits").select("*"),
      supabase.from("settlements").select("*").eq("group_id", groupId),
    ])

    setGroup(groupRes.data)
    setMembers(membersRes.data || [])
    setExpenses(expensesRes.data || [])
    setExpenseSplits(splitsRes.data || [])
    setSettlements(settlementsRes.data || [])

    // Calculate balances
    const memberBalances: Record<string, number> = {}
    membersRes.data?.forEach(m => memberBalances[m.id] = 0)

    expensesRes.data?.forEach(expense => {
      memberBalances[expense.payer_id] = (memberBalances[expense.payer_id] || 0) + Number(expense.amount)
    })

    splitsRes.data?.forEach(split => {
      memberBalances[split.member_id] = (memberBalances[split.member_id] || 0) - Number(split.amount)
    })

    settlementsRes.data?.forEach(settlement => {
      memberBalances[settlement.sender_id] = (memberBalances[settlement.sender_id] || 0) - Number(settlement.amount)
      memberBalances[settlement.receiver_id] = (memberBalances[settlement.receiver_id] || 0) + Number(settlement.amount)
    })

    setBalances(memberBalances)

    // Pre-select receiver if current user owes someone
    const currentMember = membersRes.data?.find(m => m.user_id === user?.id)
    if (currentMember && memberBalances[currentMember.id] < -0.01) {
      // Find who current user owes
      const creditors = membersRes.data?.filter(m => 
        m.id !== currentMember.id && (memberBalances[m.id] || 0) > 0.01
      ) || []
      if (creditors.length > 0) {
        setValue("receiverId", creditors[0].id)
      }
    }
  }

  // Get simplified debts
  const getDebts = () => {
    const debts: Array<{from: GroupMember, to: GroupMember, amount: number}> = []
    const memberList = members.filter(m => m.id !== currentUserId)
    
    // Find who current user owes
    const currentMember = members.find(m => m.user_id === currentUserId)
    if (!currentMember) return debts

    const currentBalance = balances[currentMember.id] || 0
    
    if (currentBalance < -0.01) {
      // Current user owes money
      const creditors = members.filter(m => m.id !== currentMember.id && (balances[m.id] || 0) > 0.01)
      creditors.forEach(creditor => {
        const creditorBalance = balances[creditor.id] || 0
        const owedAmount = Math.min(Math.abs(currentBalance), creditorBalance)
        if (owedAmount > 0.01) {
          debts.push({ from: currentMember, to: creditor, amount: owedAmount })
        }
      })
    }

    return debts
  }

  const onSubmit = async (data: SettlementFormData) => {
    setLoading(true)

    try {
      const { error } = await supabase
        .from("settlements")
        .insert({
          group_id: groupId,
          sender_id: members.find(m => m.user_id === currentUserId)?.id,
          receiver_id: data.receiverId,
          amount: data.amount,
          date: data.date,
        })

      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      toast.success("Settlement recorded!")
      router.push(`/groups/${groupId}`)
      router.refresh()
    } catch (error) {
      toast.error("Failed to record settlement")
    } finally {
      setLoading(false)
    }
  }

  const debts = getDebts()
  const currentMember = members.find(m => m.user_id === currentUserId)
  const currentBalance = currentMember ? balances[currentMember.id] || 0 : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href={`/groups/${groupId}`}>
              <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Pay Balance</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Balance</CardTitle>
            <CardDescription>How much you owe or are owed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold text-center py-4 ${
              currentBalance >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              {currentBalance >= 0 ? "+" : ""}
              {getCurrencySymbol(group?.default_currency || "USD")}
              {Math.abs(currentBalance).toFixed(2)}
            </div>
            <p className="text-center text-gray-500">
              {currentBalance >= 0 ? "You are owed money" : "You owe money"}
            </p>
          </CardContent>
        </Card>

        {currentBalance < -0.01 && debts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Suggested Settlements</CardTitle>
              <CardDescription>Based on your balance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {debts.map((debt, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Pay {debt.to.display_name}</p>
                    <p className="text-sm text-gray-500">You owe them</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {getCurrencySymbol(group?.default_currency || "USD")}
                      {debt.amount.toFixed(2)}
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setValue("receiverId", debt.to.id)
                        setValue("amount", debt.amount)
                      }}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
            <CardDescription>Log a settlement payment</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receiver">Pay To</Label>
                <Select
                  value={watchReceiverId}
                  onValueChange={(v) => setValue("receiverId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who to pay" />
                  </SelectTrigger>
                  <SelectContent>
                    {members
                      .filter(m => m.user_id !== currentUserId)
                      .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.display_name}
                        {(balances[m.id] || 0) > 0.01 && (
                          <span className="text-gray-500 ml-2">
                            (owes {getCurrencySymbol(group?.default_currency || "USD")}{Math.abs(balances[m.id]).toFixed(2)})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.receiverId && (
                  <p className="text-sm text-red-500">{errors.receiverId.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      className="pl-9"
                      {...register("amount")}
                    />
                  </div>
                  {errors.amount && (
                    <p className="text-sm text-red-500">{errors.amount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    {...register("date")}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500">{errors.date.message}</p>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Recording..." : "Record Payment"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
