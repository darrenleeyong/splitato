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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowLeft, Trash2, UserPlus, Shield, Copy, Check, Pencil, Plus, X, Eye, EyeOff, AlertTriangle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { CURRENCIES } from "@/lib/constants"
import { useGroup } from "@/hooks/useGroup"
import type { Group, GroupMember } from "@/lib/supabase/types"

const groupNameSchema = z.object({
  name: z.string().min(1, "Group name is required"),
})

const currencySchema = z.object({
  defaultCurrency: z.string(),
})

const pinSchema = z.object({
  pin: z.string().optional(),
  confirmPin: z.string().optional(),
})

const memberNameSchema = z.object({
  displayName: z.string().min(1, "Name is required"),
})

const addMemberSchema = z.object({
  displayName: z.string().min(1, "Name is required"),
})

type GroupNameFormData = z.infer<typeof groupNameSchema>
type CurrencyFormData = z.infer<typeof currencySchema>
type PinFormData = z.infer<typeof pinSchema>
type MemberNameFormData = z.infer<typeof memberNameSchema>
type AddMemberFormData = z.infer<typeof addMemberSchema>

export default function SettingsPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { verifyPin, isPinVerified } = useGroup()

  const [loading, setLoading] = useState(true)
  const [needsPinVerification, setNeedsPinVerification] = useState<boolean | null>(null)
  const [verifyingPin, setVerifyingPin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState("")
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [memberExpenseCounts, setMemberExpenseCounts] = useState<Record<string, number>>({})
  const [copiedCode, setCopiedCode] = useState(false)

  const [editingName, setEditingName] = useState(false)
  const [editingCurrency, setEditingCurrency] = useState(false)
  const [addingCurrency, setAddingCurrency] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [editingPin, setEditingPin] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)

  const groupNameForm = useForm({
    resolver: zodResolver(groupNameSchema),
    defaultValues: { name: "" },
  })

  const currencyForm = useForm({
    resolver: zodResolver(currencySchema),
    defaultValues: { defaultCurrency: "USD" },
  })

  const pinForm = useForm({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "", confirmPin: "" },
  })

  const memberNameForm = useForm({
    resolver: zodResolver(memberNameSchema),
    defaultValues: { displayName: "" },
  })

  const addMemberForm = useForm({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { displayName: "" },
  })

  useEffect(() => {
    checkPinAndLoad()
  }, [groupId, isPinVerified])

  const checkPinAndLoad = async () => {
    try {
      // First check if the group has a PIN and get basic info
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("pin_code, name, group_code")
        .eq("id", groupId)
        .single()

      setGroup(groupData as Group | null)

      if (groupError) {
        setError("Failed to load group. The group may not exist or you may not have access.")
        setLoading(false)
        return
      }

      // If no PIN is set, allow access
      if (!groupData?.pin_code) {
        setNeedsPinVerification(false)
        return
      }

      // If PIN is set, check if already verified
      setNeedsPinVerification(true)
      if (isPinVerified(groupId)) {
        fetchData()
      } else {
        setLoading(false)
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      const [groupRes, membersRes] = await Promise.all([
        supabase.from("groups").select("*").eq("id", groupId).single(),
        supabase.from("group_members").select("*").eq("group_id", groupId),
      ])

      if (groupRes.error) {
        setError("Failed to load group data. Please try again.")
        setLoading(false)
        return
      }

      setGroup(groupRes.data)
      setMembers(membersRes.data || [])
      setIsOwner(groupRes.data?.owner_id === user?.id)

      if (groupRes.data) {
        groupNameForm.setValue("name", groupRes.data.name)
        currencyForm.setValue("defaultCurrency", groupRes.data.default_currency)
      }

      const expenses = await supabase.from("expenses").select("payer_id").eq("group_id", groupId)
      const counts: Record<string, number> = {}
      expenses.data?.forEach((e: { payer_id: string }) => {
        counts[e.payer_id] = (counts[e.payer_id] || 0) + 1
      })
      setMemberExpenseCounts(counts)
      setLoading(false)
    } catch (err) {
      setError("Failed to load data. Please try again.")
      setLoading(false)
    }
  }

  const handlePinVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyingPin(true)

    const isValid = await verifyPin(groupId, pinInput)
    if (isValid) {
      toast.success("PIN verified")
      fetchData()
    } else {
      toast.error("Invalid PIN")
    }
    setVerifyingPin(false)
  }

  const handleUpdateGroupName = async (data: GroupNameFormData) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from("groups")
        .update({ name: data.name })
        .eq("id", groupId)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Group name updated")
      setEditingName(false)
      fetchData()
    } catch (error) {
      toast.error("Failed to update group name")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCurrency = async (data: CurrencyFormData) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from("groups")
        .update({ default_currency: data.defaultCurrency })
        .eq("id", groupId)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Default currency updated")
      setEditingCurrency(false)
      fetchData()
    } catch (error) {
      toast.error("Failed to update currency")
    } finally {
      setLoading(false)
    }
  }

  const handleAddCurrency = async (currency: string) => {
    setLoading(true)
    try {
      const updateData: Partial<Group> = {}
      if (!group?.additional_currency_1) {
        updateData.additional_currency_1 = currency
      } else if (!group?.additional_currency_2) {
        updateData.additional_currency_2 = currency
      }

      const { error } = await supabase
        .from("groups")
        .update(updateData)
        .eq("id", groupId)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Currency added")
      setAddingCurrency(false)
      fetchData()
    } catch (error) {
      toast.error("Failed to add currency")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveCurrency = async (currencyField: "additional_currency_1" | "additional_currency_2") => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from("groups")
        .update({ [currencyField]: null })
        .eq("id", groupId)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Currency removed")
      fetchData()
    } catch (error) {
      toast.error("Failed to remove currency")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePin = async (data: PinFormData) => {
    if (data.pin && data.pin.length !== 4) {
      toast.error("PIN must be exactly 4 digits")
      return
    }

    if (data.pin && data.pin !== data.confirmPin) {
      toast.error("PINs do not match")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from("groups")
        .update({ pin_code: data.pin || "" })
        .eq("id", groupId)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("PIN updated")
      setEditingPin(false)
      pinForm.reset()
      fetchData()
    } catch (error) {
      toast.error("Failed to update PIN")
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSimplifyDebts = async () => {
    if (!group) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from("groups")
        .update({ simplify_debts: !group.simplify_debts })
        .eq("id", groupId)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success(group.simplify_debts ? "Simplify debts disabled" : "Simplify debts enabled")
      fetchData()
    } catch (error) {
      toast.error("Failed to update setting")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateMemberName = async (memberId: string) => {
    const data = memberNameForm.getValues()
    setLoading(true)
    try {
      const { error } = await supabase
        .from("group_members")
        .update({ display_name: data.displayName })
        .eq("id", memberId)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Member name updated")
      setEditingMemberId(null)
      memberNameForm.reset()
      fetchData()
    } catch (error) {
      toast.error("Failed to update member name")
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (data: AddMemberFormData) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from("group_members")
        .insert({
          group_id: groupId,
          user_id: user?.id || `temp_${Date.now()}`,
          display_name: data.displayName,
        })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Member added")
      setIsAddMemberOpen(false)
      addMemberForm.reset()
      fetchData()
    } catch (error) {
      toast.error("Failed to add member")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    const expenseCount = memberExpenseCounts[memberId] || 0
    const member = members.find(m => m.id === memberId)
    
    if (expenseCount > 0) {
      if (!confirm(`This member has ${expenseCount} expense(s). Are you sure you want to remove them?`)) {
        return
      }
    } else {
      if (!confirm(`Remove ${member?.display_name} from the group?`)) {
        return
      }
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("id", memberId)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Member removed")
      fetchData()
    } catch (error) {
      toast.error("Failed to remove member")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Group deleted")
      router.push("/")
    } catch (error) {
      toast.error("Failed to delete group")
    } finally {
      setLoading(false)
    }
  }

  const handleCopyGroupCode = async () => {
    if (group?.group_code) {
      await navigator.clipboard.writeText(group.group_code)
      setCopiedCode(true)
      toast.success("Group code copied!")
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const startEditingMember = (member: GroupMember) => {
    setEditingMemberId(member.id)
    memberNameForm.setValue("displayName", member.display_name || "")
  }

  // Show error if any
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-gray-900 dark:text-white">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-500 dark:text-gray-400">{error}</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setError(null)
                  setLoading(true)
                  setNeedsPinVerification(null)
                  checkPinAndLoad()
                }}
                className="w-full bg-[#1A1A1A] hover:bg-[#2D2D2D] dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/groups/${groupId}`)}
                className="w-full dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Group
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading while checking PIN status
  if (needsPinVerification === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (needsPinVerification && !isPinVerified(groupId)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            {group && (
              <div className="mb-2 text-center">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{group.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Code: {group.group_code}</p>
              </div>
            )}
            <CardTitle className="text-gray-900 dark:text-white">Enter Group PIN</CardTitle>
            <CardDescription className="dark:text-gray-400">Enter the 4-digit PIN to access settings</CardDescription>
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
                <Button variant="link" onClick={() => router.push(`/groups/${groupId}`)} className="dark:text-gray-300">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Group
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <header className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href={`/groups/${groupId}`}>
              <Button variant="ghost" size="sm" className="p-0 h-8 w-8 dark:text-gray-100" aria-label="Go back to group">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Group Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name" className="text-gray-900 dark:text-white">Group Name</Label>
              {editingName ? (
                <form onSubmit={groupNameForm.handleSubmit(handleUpdateGroupName)} className="flex gap-2">
                  <Input
                    id="group-name"
                    {...groupNameForm.register("name")}
                    aria-invalid={!!groupNameForm.formState.errors.name}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <Button type="submit" disabled={loading}>Save</Button>
                  <Button type="button" variant="outline" onClick={() => {
                    setEditingName(false)
                    groupNameForm.reset({ name: group?.name || "" })
                  }}>Cancel</Button>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 dark:text-white">{group?.name}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingName(true)}
                    aria-label="Edit group name"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <Separator className="dark:border-gray-700" />

            <div className="space-y-2">
              <Label className="text-gray-900 dark:text-white">Group Code</Label>
              <div className="flex items-center justify-between">
                <p className="font-mono text-lg tracking-widest text-gray-900 dark:text-white">{group?.group_code}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyGroupCode}
                  aria-label="Copy group code"
                >
                  {copiedCode ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Share this code with others to join the group</p>
            </div>

            <Separator className="dark:border-gray-700" />

            <div className="space-y-2">
              <Label htmlFor="default-currency" className="text-gray-900 dark:text-white">Default Currency</Label>
              {editingCurrency ? (
                <form onSubmit={currencyForm.handleSubmit(handleUpdateCurrency)} className="flex gap-2">
                  <Select
                    value={currencyForm.watch("defaultCurrency")}
                    onValueChange={(v) => currencyForm.setValue("defaultCurrency", v)}
                  >
                    <SelectTrigger id="default-currency" className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.symbol} {c.code} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={loading}>Save</Button>
                  <Button type="button" variant="outline" onClick={() => {
                    setEditingCurrency(false)
                    currencyForm.reset({ defaultCurrency: group?.default_currency || "USD" })
                  }}>Cancel</Button>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 dark:text-white">{group?.default_currency}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingCurrency(true)}
                    aria-label="Edit default currency"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900 dark:text-white">Currencies</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 border rounded-md dark:border-gray-600">
                  <span className="font-medium text-gray-900 dark:text-white">{group?.default_currency}</span>
                  <Badge variant="outline">Main</Badge>
                </div>
                {group?.additional_currency_1 && (
                  <div className="flex items-center justify-between p-2 border rounded-md dark:border-gray-600">
                    <span className="font-medium text-gray-900 dark:text-white">{group.additional_currency_1}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveCurrency("additional_currency_1")}
                      aria-label={`Remove ${group.additional_currency_1} currency`}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                )}
                {group?.additional_currency_2 && (
                  <div className="flex items-center justify-between p-2 border rounded-md dark:border-gray-600">
                    <span className="font-medium text-gray-900 dark:text-white">{group.additional_currency_2}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveCurrency("additional_currency_2")}
                      aria-label={`Remove ${group.additional_currency_2} currency`}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                )}
                {!group?.additional_currency_1 && !group?.additional_currency_2 && !addingCurrency && (
                  <Button variant="outline" size="sm" onClick={() => setAddingCurrency(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Currency
                  </Button>
                )}
                {addingCurrency && (
                  <Select
                    onValueChange={(value) => {
                      handleAddCurrency(value)
                    }}
                  >
                    <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.filter(c => 
                        c.code !== group?.default_currency && 
                        c.code !== group?.additional_currency_1 &&
                        c.code !== group?.additional_currency_2
                      ).map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.symbol} {c.code} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <Separator className="dark:border-gray-700" />

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Shield className="h-4 w-4" />
                PIN Code
              </Label>
              {editingPin ? (
                <form onSubmit={pinForm.handleSubmit(handleUpdatePin)} className="space-y-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="New 4-digit PIN"
                    {...pinForm.register("pin")}
                    aria-label="New PIN"
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Confirm new PIN"
                    {...pinForm.register("confirmPin")}
                    aria-label="Confirm new PIN"
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>Save PIN</Button>
                    <Button type="button" variant="outline" onClick={() => {
                      setEditingPin(false)
                      pinForm.reset()
                    }}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="font-medium font-mono text-gray-900 dark:text-white">
                    {group?.pin_code ? (showPin ? group.pin_code : "••••") : "No PIN set"}
                  </p>
                  <div className="flex gap-2">
                    {group?.pin_code && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPin(!showPin)}
                        aria-label={showPin ? "Hide PIN" : "Show PIN"}
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                    {isOwner && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPin(true)}
                        aria-label="Change PIN"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {!isOwner && !group?.pin_code && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Ask the owner to set a PIN</p>
              )}
            </div>

            <Separator className="dark:border-gray-700" />

            <div className="space-y-2">
              <Label className="flex items-center justify-between text-gray-900 dark:text-white">
                <span>Simplify Debts</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={group?.simplify_debts}
                  onClick={handleToggleSimplifyDebts}
                  disabled={loading}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    group?.simplify_debts ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      group?.simplify_debts ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                When enabled, simplifies debts to reduce the number of transfers needed (like Splitwise)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700 border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            {isOwner ? (
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDeleteGroup}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Group
              </Button>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-2">
                Only the group owner can delete this group
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
