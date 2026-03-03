"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Plus, Trash2, Upload, Calculator } from "lucide-react"
import { toast } from "sonner"
import { CURRENCIES, getCurrencySymbol } from "@/lib/constants"
import type { Group, GroupMember } from "@/lib/supabase/types"

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  currency: z.string(),
  date: z.string().min(1, "Date is required"),
  payerId: z.string().min(1, "Payer is required"),
  splitType: z.enum(["even", "percentage", "specific"]),
  splits: z.array(z.object({
    memberId: z.string(),
    amount: z.coerce.number().min(0),
    percentage: z.coerce.number().min(0).max(100).optional(),
  })),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

export default function AddExpensePage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
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
      splits: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "splits",
  })

  const watchAmount = watch("amount")
  const watchSplitType = watch("splitType")
  const watchPayerId = watch("payerId")

  useEffect(() => {
    fetchGroupData()
  }, [])

  useEffect(() => {
    if (members.length > 0 && watchSplitType === "even") {
      const evenAmount = Number(watchAmount) / members.length
      const newSplits = members.map(m => ({
        memberId: m.id,
        amount: evenAmount,
        percentage: 100 / members.length,
      }))
      setValue("splits", newSplits)
    }
  }, [members.length, watchAmount, watchSplitType, setValue])

  const fetchGroupData = async () => {
    const [groupRes, membersRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("group_members").select("*").eq("group_id", groupId),
    ])

    setGroup(groupRes.data)
    setMembers(membersRes.data || [])
    if (membersRes.data && membersRes.data.length > 0) {
      setValue("payerId", membersRes.data[0].id)
    }
    if (groupRes.data) {
      setValue("currency", groupRes.data.default_currency)
    }
  }

  const getGroupCurrencies = () => {
    if (!group) return CURRENCIES
    const currencies = [group.default_currency]
    if (group.additional_currency_1) currencies.push(group.additional_currency_1)
    if (group.additional_currency_2) currencies.push(group.additional_currency_2)
    return CURRENCIES.filter(c => currencies.includes(c.code))
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

  const onSubmit = async (data: ExpenseFormData) => {
    if (data.splits.length === 0) {
      toast.error("At least one split is required")
      return
    }

    const totalSplit = data.splits.reduce((sum, s) => sum + Number(s.amount), 0)
    if (Math.abs(totalSplit - Number(data.amount)) > 0.01) {
      toast.error("Split amounts must equal the total amount")
      return
    }

    setLoading(true)

    try {
      // Create expense
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          group_id: groupId,
          payer_id: data.payerId,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          date: data.date,
          split_type: data.splitType,
        })
        .select()
        .single()

      if (expenseError) {
        toast.error(expenseError.message)
        setLoading(false)
        return
      }

      // Upload receipt if exists
      if (receiptFile && expense) {
        const receiptUrl = await uploadReceipt(expense.id)
        if (receiptUrl) {
          await supabase
            .from("expenses")
            .update({ receipt_url: receiptUrl })
            .eq("id", expense.id)
        }
      }

      // Create splits
      const splitsData = data.splits.map(s => ({
        expense_id: expense.id,
        member_id: s.memberId,
        amount: s.amount,
        percentage: s.percentage || null,
      }))

      const { error: splitsError } = await supabase
        .from("expense_splits")
        .insert(splitsData)

      if (splitsError) {
        toast.error(splitsError.message)
        setLoading(false)
        return
      }

      toast.success("Expense added!")
      router.push(`/groups/${groupId}`)
      router.refresh()
    } catch (error) {
      toast.error("Failed to add expense")
    } finally {
      setLoading(false)
    }
  }

  const calculateEvenSplits = () => {
    const amount = Number(watchAmount)
    const evenAmount = amount / members.length
    return members.map(m => ({
      memberId: m.id,
      amount: evenAmount,
      percentage: 100 / members.length,
    }))
  }

  const handlePercentageChange = (index: number, percentage: number) => {
    const amount = Number(watchAmount)
    const newAmount = (amount * percentage) / 100
    const newSplits = [...fields.map((_, i) => ({
      memberId: members[i].id,
      amount: i === index ? newAmount : fields[i]?.amount || 0,
      percentage: i === index ? percentage : fields[i]?.percentage || 0,
    }))]
    setValue("splits", newSplits)
  }

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
            <h1 className="text-xl font-bold">Add Expense</h1>
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
                      {getGroupCurrencies().map((c) => (
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
                      <span>Upload</span>
                    </div>
                  </label>
                  {receiptPreview && (
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
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
                            value={(Number(fields[index]?.percentage) || 0).toFixed(1)}
                            onChange={(e) => handlePercentageChange(index, Number(e.target.value))}
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
                            {...register(`splits.${index}.amount` as const, {
                              valueAsNumber: true,
                            })}
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
                    Math.abs((fields.reduce((sum, f) => sum + Number(f.amount || 0), 0)) - Number(watchAmount || 0)) > 0.01
                      ? "text-red-500"
                      : "text-green-500"
                  }`}>
                    {getCurrencySymbol(watch("currency"))}
                    {fields.reduce((sum, f) => sum + Number(f.amount || 0), 0).toFixed(2)}
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
              {loading ? "Saving..." : "Add Expense"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
