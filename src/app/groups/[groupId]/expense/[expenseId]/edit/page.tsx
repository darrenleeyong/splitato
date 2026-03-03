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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Upload, Calculator, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { CURRENCIES, getCurrencySymbol } from "@/lib/constants"
import type { Group, GroupMember, Expense, ExpenseSplit } from "@/lib/supabase/types"

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  currency: z.string(),
  date: z.string().min(1, "Date is required"),
  payerId: z.string().min(1, "Payer is required"),
  splitType: z.enum(["even", "percentage", "specific"]),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

export default function EditExpensePage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const expenseId = params.expenseId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [expense, setExpense] = useState<Expense | null>(null)
  const [splits, setSplits] = useState<ExpenseSplit[]>([])
  const [splitsInput, setSplitsInput] = useState<Array<{memberId: string, amount: number, percentage: number}>>([])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      currency: "USD",
      date: new Date().toISOString().split("T")[0],
      payerId: "",
      splitType: "even",
    },
  })

  const watchAmount = watch("amount")
  const watchSplitType = watch("splitType")
  const watchPayerId = watch("payerId")

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (members.length > 0 && watchSplitType === "even") {
      const evenAmount = Number(watchAmount) / members.length
      const newSplits = members.map(m => ({
        memberId: m.id,
        amount: evenAmount,
        percentage: 100 / members.length,
      }))
      setSplitsInput(newSplits)
    }
  }, [members.length, watchAmount, watchSplitType, setValue])

  const fetchData = async () => {
    const [groupRes, membersRes, expenseRes, splitsRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("group_members").select("*").eq("group_id", groupId),
      supabase.from("expenses").select("*").eq("id", expenseId).single(),
      supabase.from("expense_splits").select("*").eq("expense_id", expenseId),
    ])

    setGroup(groupRes.data)
    setMembers(membersRes.data || [])
    setExpense(expenseRes.data)
    setSplits(splitsRes.data || [])
    setExistingReceiptUrl(expenseRes.data?.receipt_url || null)

    if (expenseRes.data) {
      setValue("description", expenseRes.data.description)
      setValue("amount", Number(expenseRes.data.amount))
      setValue("currency", expenseRes.data.currency)
      setValue("date", expenseRes.data.date)
      setValue("payerId", expenseRes.data.payer_id)
      setValue("splitType", expenseRes.data.split_type as "even" | "percentage" | "specific")

      if (expenseRes.data.receipt_url) {
        setReceiptPreview(expenseRes.data.receipt_url)
      }
    }

    if (splitsRes.data && membersRes.data) {
      const memberSplits = membersRes.data.map(m => {
        const split = splitsRes.data?.find(s => s.member_id === m.id)
        return {
          memberId: m.id,
          amount: split ? Number(split.amount) : 0,
          percentage: split ? Number(split.percentage || 0) : 0,
        }
      })
      setSplitsInput(memberSplits)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadReceipt = async (expenseId: string): Promise<string | null> => {
    if (!receiptFile) return null

    const fileExt = receiptFile.name.split(".").pop()
    const fileName = `${expenseId}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, receiptFile, { upsert: true })

    if (uploadError) {
      toast.error("Failed to upload receipt")
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from("receipts")
      .getPublicUrl(fileName)

    return publicUrl
  }

  const handleSplitChange = (index: number, field: "amount" | "percentage", value: number) => {
    const newSplits = [...splitsInput]
    newSplits[index][field] = value

    if (field === "percentage") {
      newSplits[index].amount = (Number(watchAmount) * value) / 100
    } else if (field === "amount") {
      newSplits[index].percentage = (value / Number(watchAmount)) * 100
    }

    setSplitsInput(newSplits)
  }

  const onSubmit = async (data: ExpenseFormData) => {
    const totalSplit = splitsInput.reduce((sum, s) => sum + Number(s.amount), 0)
    if (Math.abs(totalSplit - Number(data.amount)) > 0.01) {
      toast.error("Split amounts must equal the total amount")
      return
    }

    setLoading(true)

    try {
      if (!expense) {
        toast.error("Expense not found")
        setLoading(false)
        return
      }

      let receiptUrl = existingReceiptUrl

      if (receiptFile) {
        receiptUrl = await uploadReceipt(expense.id)
      }

      // Update expense
      const { error: expenseError } = await supabase
        .from("expenses")
        .update({
          description: data.description,
          amount: data.amount,
          currency: data.currency,
          date: data.date,
          payer_id: data.payerId,
          split_type: data.splitType,
          receipt_url: receiptUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", expenseId)

      if (expenseError) {
        toast.error(expenseError.message)
        setLoading(false)
        return
      }

      // Delete existing splits and create new ones
      await supabase
        .from("expense_splits")
        .delete()
        .eq("expense_id", expenseId)

      const splitsData = splitsInput.map(s => ({
        expense_id: expenseId,
        member_id: s.memberId,
        amount: s.amount,
        percentage: s.percentage,
      }))

      const { error: splitsError } = await supabase
        .from("expense_splits")
        .insert(splitsData)

      if (splitsError) {
        toast.error(splitsError.message)
        setLoading(false)
        return
      }

      toast.success("Expense updated!")
      router.push(`/groups/${groupId}`)
      router.refresh()
    } catch (error) {
      toast.error("Failed to update expense")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this expense?")) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId)

      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      toast.success("Expense deleted")
      router.push(`/groups/${groupId}`)
      router.refresh()
    } catch (error) {
      toast.error("Failed to delete expense")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/groups/${groupId}`}>
                <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold">Modify Expense</h1>
            </div>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Expense Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="What was this expense for?"
                  {...register("description")}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register("amount")}
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-500">{errors.amount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={watch("currency")}
                    onValueChange={(v) => setValue("currency", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.symbol} {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

                <div className="space-y-2">
                  <Label htmlFor="payer">Paid By</Label>
                  <Select
                    value={watchPayerId}
                    onValueChange={(v) => setValue("payerId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payer" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.payerId && (
                    <p className="text-sm text-red-500">{errors.payerId.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Receipt (optional)</Label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50">
                      <Upload className="h-4 w-4" />
                      <span>Change</span>
                    </div>
                  </label>
                  {receiptPreview && (
                    <img
                      src={receiptPreview}
                      alt="Receipt"
                      className="h-16 w-16 object-cover rounded-md"
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Split Details
              </CardTitle>
              <CardDescription>How should this expense be split?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Split Type</Label>
                <Select
                  value={watchSplitType}
                  onValueChange={(v: "even" | "percentage" | "specific") => setValue("splitType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="even">Evenly</SelectItem>
                    <SelectItem value="percentage">By Percentage</SelectItem>
                    <SelectItem value="specific">Specific Amounts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-3">
                {members.map((member, index) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {member.display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span>{member.display_name}</span>
                      {member.id === watchPayerId && (
                        <Badge variant="secondary" className="text-xs">Payer</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {watchSplitType === "percentage" ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            className="w-20 h-8"
                            value={splitsInput[index]?.percentage?.toFixed(1) || "0"}
                            onChange={(e) => handleSplitChange(index, "percentage", Number(e.target.value))}
                          />
                          <span className="text-sm">%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">{getCurrencySymbol(watch("currency"))}</span>
                          <Input
                            type="number"
                            className="w-24 h-8"
                            step="0.01"
                            value={splitsInput[index]?.amount?.toFixed(2) || "0"}
                            onChange={(e) => handleSplitChange(index, "amount", Number(e.target.value))}
                            disabled={watchSplitType === "even"}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold">
                    {getCurrencySymbol(watch("currency"))}{Number(watchAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Split Total</span>
                  <span className={`font-semibold ${
                    Math.abs((splitsInput.reduce((sum, s) => sum + Number(s.amount), 0)) - Number(watchAmount || 0)) > 0.01
                      ? "text-red-500"
                      : "text-green-500"
                  }`}>
                    {getCurrencySymbol(watch("currency"))}
                    {splitsInput.reduce((sum, s) => sum + Number(s.amount), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
