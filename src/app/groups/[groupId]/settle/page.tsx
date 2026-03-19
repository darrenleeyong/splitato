"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
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
import { getCurrencySymbol, CURRENCIES } from "@/lib/constants"
import type { Group, GroupMember, Expense, ExpenseSplit, Settlement } from "@/lib/supabase/types"

const settlementSchema = z.object({
  senderId: z.string().min(1, "Payer is required"),
  receiverId: z.string().min(1, "Receiver is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  currency: z.string().min(1, "Currency is required"),
  date: z.string().min(1, "Date is required"),
})

type SettlementFormData = z.infer<typeof settlementSchema>

export default function PayBalancePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
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
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(settlementSchema),
    defaultValues: {
      senderId: "",
      receiverId: "",
      amount: 0,
      currency: "SGD",
      date: new Date().toISOString().split("T")[0],
    },
  })

  const watchSenderId = watch("senderId")
  const watchReceiverId = watch("receiverId")
  const watchAmount = watch("amount")
  const watchCurrency = watch("currency")

  useEffect(() => {
    fetchData()
  }, [])

  // Apply query params to form after data is loaded
  useEffect(() => {
    if (members.length > 0) {
      const senderId = searchParams.get("senderId")
      const receiverId = searchParams.get("receiverId")
      const amount = searchParams.get("amount")
      const currency = searchParams.get("currency")

      if (senderId) {
        setValue("senderId", senderId)
      }
      if (receiverId) {
        setValue("receiverId", receiverId)
      }
      if (amount) {
        setValue("amount", Math.round(parseFloat(amount) * 100) / 100)
      }
      if (currency) {
        setValue("currency", currency)
      }
    }
  }, [members, searchParams, setValue])

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
    membersRes.data?.forEach((m: { id: string }) => memberBalances[m.id] = 0)

    expensesRes.data?.forEach((expense: { payer_id: string, amount: number, expense_splits?: { member_id: string, amount: number }[] }) => {
      memberBalances[expense.payer_id] = (memberBalances[expense.payer_id] || 0) + Number(expense.amount)
    })

    splitsRes.data?.forEach((split: { member_id: string, amount: number }) => {
      memberBalances[split.member_id] = (memberBalances[split.member_id] || 0) - Number(split.amount)
    })

    settlementsRes.data?.forEach((settlement: { sender_id: string, receiver_id: string, amount: number }) => {
      memberBalances[settlement.sender_id] = (memberBalances[settlement.sender_id] || 0) - Number(settlement.amount)
      memberBalances[settlement.receiver_id] = (memberBalances[settlement.receiver_id] || 0) + Number(settlement.amount)
    })

    setBalances(memberBalances)

    // Pre-select receiver if current user owes someone
    const currentMember = membersRes.data?.find((m: { user_id: string, id: string }) => m.user_id === user?.id)
    if (currentMember && memberBalances[currentMember.id] < -0.01) {
      // Find who current user owes
      const creditors = membersRes.data?.filter((m: { id: string }) => 
        m.id !== currentMember.id && (memberBalances[m.id] || 0) > 0.01
      ) || []
      if (creditors.length > 0) {
        setValue("receiverId", creditors[0].id)
      }
    }
  }

  // Calculate amount owed from sender to receiver
  const calculateOwedAmount = (senderId: string, receiverId: string): number => {
    if (!senderId || !receiverId || senderId === receiverId) return 0
    
    const senderMember = members.find(m => m.id === senderId)
    const receiverMember = members.find(m => m.id === receiverId)
    
    if (!senderMember || !receiverMember) return 0
    
    const senderBalance = balances[senderId] || 0
    const receiverBalance = balances[receiverId] || 0
    
    // If sender owes receiver (sender has negative balance towards receiver)
    // We need to calculate direct debt between these two members
    
    let amountOwed = 0
    
    // Calculate total expenses paid by receiver for sender
    const expensesPaidByReceiver = expenses.filter(e => 
      e.payer_id === receiverId
    )
    
    const splitsForSender = expenseSplits.filter(s => 
      s.member_id === senderId
    )
    
    // Calculate what receiver paid that involved sender
    let receiverPaidForSender = 0
    expensesPaidByReceiver.forEach(expense => {
      const split = splitsForSender.find(s => s.expense_id === expense.id)
      if (split) {
        receiverPaidForSender += Number(split.amount)
      }
    })
    
    // Calculate what sender paid that involved receiver
    const expensesPaidBySender = expenses.filter(e => 
      e.payer_id === senderId
    )
    
    const splitsForReceiver = expenseSplits.filter(s => 
      s.member_id === receiverId
    )
    
    let senderPaidForReceiver = 0
    expensesPaidBySender.forEach(expense => {
      const split = splitsForReceiver.find(s => s.expense_id === expense.id)
      if (split) {
        senderPaidForReceiver += Number(split.amount)
      }
    })
    
    // Net amount: positive means sender owes receiver
    amountOwed = senderPaidForReceiver - receiverPaidForSender
    
    // Account for settlements
    const settlementsFromSenderToReceiver = settlements.filter(s => 
      s.sender_id === senderId && s.receiver_id === receiverId
    )
    const settlementsFromReceiverToSender = settlements.filter(s => 
      s.sender_id === receiverId && s.receiver_id === senderId
    )
    
    const senderSettled = settlementsFromSenderToReceiver.reduce((sum, s) => sum + Number(s.amount), 0)
    const receiverSettled = settlementsFromReceiverToSender.reduce((sum, s) => sum + Number(s.amount), 0)
    
    amountOwed = amountOwed - senderSettled + receiverSettled
    
    return Math.max(0, amountOwed)
  }

  // Handle receiver change and auto-fill amount
  const handleReceiverChange = (receiverId: string) => {
    setValue("receiverId", receiverId)
    if (watchSenderId) {
      const owed = calculateOwedAmount(watchSenderId, receiverId)
      if (owed > 0.01) {
        setValue("amount", Math.round(owed * 100) / 100)
      }
    }
  }

  // Handle sender change
  const handleSenderChange = (senderId: string) => {
    setValue("senderId", senderId)
    if (watchReceiverId) {
      const owed = calculateOwedAmount(senderId, watchReceiverId)
      if (owed > 0.01) {
        setValue("amount", Math.round(owed * 100) / 100)
      } else {
        trigger("amount")
      }
    }
  }

  const onSubmit = async (data: SettlementFormData) => {
    setLoading(true)

    try {
      const { error } = await supabase
        .from("settlements")
        .insert({
          group_id: groupId,
          sender_id: data.senderId,
          receiver_id: data.receiverId,
          amount: data.amount,
          currency: data.currency,
          date: data.date,
        })

      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      toast.success("Settlement recorded!")
      router.push(`/groups/${groupId}?tab=balances`)
      router.refresh()
    } catch (error) {
      toast.error("Failed to record settlement")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b sticky top-0 z-10">
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
        <Card className="py-6">
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
            <CardDescription>Log a settlement payment</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sender">Payer</Label>
                <Select
                  value={watchSenderId}
                  onValueChange={handleSenderChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who is paying" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.senderId && (
                  <p className="text-sm text-red-500">{errors.senderId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiver">Pay To</Label>
                <Select
                  value={watchReceiverId}
                  onValueChange={handleReceiverChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who to pay" />
                  </SelectTrigger>
                  <SelectContent>
                    {members
                      .filter(m => m.id !== watchSenderId)
                      .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.receiverId && (
                  <p className="text-sm text-red-500">{errors.receiverId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={watchCurrency}
                  onValueChange={(value) => setValue("currency", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.symbol} {c.code} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.currency && (
                  <p className="text-sm text-red-500">{errors.currency.message}</p>
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
