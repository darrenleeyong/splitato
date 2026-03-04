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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  ArrowLeft, 
  Plus, 
  DollarSign, 
  Users, 
  Settings, 
  Receipt, 
  Wallet,
  ArrowRight,
  Pencil,
  Trash2,
  UserPlus,
  X,
  Copy,
  Check,
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Home
} from "lucide-react"
import { toast } from "sonner"
import { useGroup } from "@/hooks/useGroup"
import { getCurrencySymbol, CURRENCIES, getCategoryEmoji } from "@/lib/constants"
import type { Group, GroupMember, Expense, ExpenseSplit, Settlement } from "@/lib/supabase/types"
import { MemberAvatar } from "@/components/ui/avatar"

export default function GroupDashboardPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { verifyPin, isPinVerified, clearPinVerification } = useGroup()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [verifyingPin, setVerifyingPin] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [group, setGroup] = useState<Group | null>(null)
  const [groupBasicInfo, setGroupBasicInfo] = useState<{ name: string; group_code: string } | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [expenseSplits, setExpenseSplits] = useState<ExpenseSplit[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Settings state
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const [editingCurrency, setEditingCurrency] = useState(false)
  const [currencyInput, setCurrencyInput] = useState("USD")
  const [addingCurrency, setAddingCurrency] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [editingPin, setEditingPin] = useState(false)
  const [pinInputNew, setPinInputNew] = useState("")
  const [pinConfirmNew, setPinConfirmNew] = useState("")
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [memberNameInput, setMemberNameInput] = useState("")
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [addMemberInput, setAddMemberInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [isPeopleOpen, setIsPeopleOpen] = useState(false)
  const [showDeleteMemberDialog, setShowDeleteMemberDialog] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<{id: string, name: string} | null>(null)

  useEffect(() => {
    // Set a timeout to show error message if loading takes too long
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoadingTimeout(true)
      }
    }, 120000) // 2 minutes

    // Fetch basic group info for PIN screen
    fetchBasicGroupInfo()

    if (isPinVerified(groupId)) {
      fetchGroupData()
    } else {
      setLoading(false)
    }

    return () => clearTimeout(timeoutId)
  }, [groupId, isPinVerified])

  const fetchBasicGroupInfo = async () => {
    try {
      const { data } = await supabase
        .from("groups")
        .select("name, group_code")
        .eq("id", groupId)
        .single()
      setGroupBasicInfo(data)
    } catch (err) {
      // Ignore - will show generic message
    }
  }

  const fetchGroupData = async () => {
    setLoading(true)
    setError(null)
    setLoadingTimeout(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      const [groupRes, membersRes, expensesRes, settlementsRes, splitsRes] = await Promise.all([
        supabase.from("groups").select("*").eq("id", groupId).single(),
        supabase.from("group_members").select("*").eq("group_id", groupId),
        supabase.from("expenses").select("*").eq("group_id", groupId).order("date", { ascending: false }),
        supabase.from("settlements").select("*").eq("group_id", groupId).order("date", { ascending: false }),
        supabase.from("expense_splits").select("*")
      ])

      if (groupRes.error) {
        setError("Failed to load group. The group may not exist or you may not have access.")
        setLoading(false)
        return
      }

      setGroup(groupRes.data)
      setMembers(membersRes.data || [])
      setExpenses(expensesRes.data || [])
      setSettlements(settlementsRes.data || [])
      setExpenseSplits(splitsRes.data || [])
      
      if (groupRes.data) {
        setNameInput(groupRes.data.name)
        setCurrencyInput(groupRes.data.default_currency)
      }
      setLoading(false)
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  const isOwner = group?.owner_id === currentUserId

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

  // Settings handlers
  const handleUpdateGroupName = async () => {
    if (!nameInput.trim()) {
      toast.error("Group name is required")
      return
    }
    setSaving(true)
    const { error } = await supabase.from("groups").update({ name: nameInput.trim() }).eq("id", groupId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Group name updated")
      setEditingName(false)
      fetchGroupData()
    }
    setSaving(false)
  }

  const handleUpdateCurrency = async () => {
    setSaving(true)
    const { error } = await supabase.from("groups").update({ default_currency: currencyInput }).eq("id", groupId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Default currency updated")
      setEditingCurrency(false)
      fetchGroupData()
    }
    setSaving(false)
  }

  const handleAddCurrency = async (currency: string) => {
    setSaving(true)
    const updateData: Partial<Group> = {}
    if (!group?.additional_currency_1) {
      updateData.additional_currency_1 = currency
    } else if (!group?.additional_currency_2) {
      updateData.additional_currency_2 = currency
    }
    const { error } = await supabase.from("groups").update(updateData).eq("id", groupId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Currency added")
      setAddingCurrency(false)
      fetchGroupData()
    }
    setSaving(false)
  }

  const handleRemoveCurrency = async (field: "additional_currency_1" | "additional_currency_2") => {
    setSaving(true)
    const { error } = await supabase.from("groups").update({ [field]: null }).eq("id", groupId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Currency removed")
      fetchGroupData()
    }
    setSaving(false)
  }

  const handleUpdatePin = async () => {
    if (pinInputNew && pinInputNew.length !== 4) {
      toast.error("PIN must be exactly 4 digits")
      return
    }
    if (pinInputNew !== pinConfirmNew) {
      toast.error("PINs do not match")
      return
    }
    setSaving(true)
    const { error } = await supabase.from("groups").update({ pin_code: pinInputNew || "" }).eq("id", groupId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("PIN updated")
      setEditingPin(false)
      setPinInputNew("")
      setPinConfirmNew("")
      fetchGroupData()
    }
    setSaving(false)
  }

  const handleToggleSimplifyDebts = async () => {
    setSaving(true)
    const { error } = await supabase.from("groups").update({ simplify_debts: !group?.simplify_debts }).eq("id", groupId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(group?.simplify_debts ? "Simplify debts disabled" : "Simplify debts enabled")
      fetchGroupData()
    }
    setSaving(false)
  }

  const handleUpdateMemberName = async (memberId: string) => {
    if (!memberNameInput.trim()) {
      toast.error("Name is required")
      return
    }
    setSaving(true)
    const { error } = await supabase.from("group_members").update({ display_name: memberNameInput.trim() }).eq("id", memberId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Member name updated")
      setEditingMemberId(null)
      fetchGroupData()
    }
    setSaving(false)
  }

  const handleAddMember = async () => {
    if (!addMemberInput.trim()) {
      toast.error("Name is required")
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("group_members").insert({
      group_id: groupId,
      user_id: user?.id || `temp_${Date.now()}`,
      display_name: addMemberInput.trim()
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Member added")
      setIsAddMemberOpen(false)
      setAddMemberInput("")
      fetchGroupData()
    }
    setSaving(false)
  }

  const handleRemoveMember = async () => {
    if (!memberToDelete) return
    
    setSaving(true)
    const { error } = await supabase.from("group_members").delete().eq("id", memberToDelete.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Member removed")
      fetchGroupData()
    }
    setSaving(false)
    setShowDeleteMemberDialog(false)
    setMemberToDelete(null)
  }

  const openDeleteMemberDialog = (memberId: string) => {
    const member = members.find(m => m.id === memberId)
    setMemberToDelete({ id: memberId, name: member?.display_name || "this member" })
    setShowDeleteMemberDialog(true)
  }

  const handleDeleteGroup = async () => {
    if (!confirm("Are you sure you want to delete this group? This action cannot be undone.")) return
    setSaving(true)
    const { error } = await supabase.from("groups").delete().eq("id", groupId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Group deleted")
      router.push("/")
    }
    setSaving(false)
  }

  const handleCopyCode = async () => {
    if (group?.group_code) {
      await navigator.clipboard.writeText(group.group_code)
      setCopiedCode(true)
      toast.success("Group code copied!")
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  if (!isPinVerified(groupId)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            {groupBasicInfo && (
              <div className="mb-2 text-center">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{groupBasicInfo.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Code: {groupBasicInfo.group_code}</p>
              </div>
            )}
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
                  fetchGroupData()
                }}
                className="w-full bg-[#1A1A1A] hover:bg-[#2D2D2D] dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="w-full dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading timeout message
  if (loadingTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <CardTitle className="text-gray-900 dark:text-white">Loading Taking Too Long</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-500 dark:text-gray-400">
              The page is taking longer than expected to load. This might be due to network issues.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setLoadingTimeout(false)
                  fetchGroupData()
                }}
                className="w-full bg-[#1A1A1A] hover:bg-[#2D2D2D] dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="w-full dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Home
              </Button>
            </div>
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

  // Calculate balances by currency
  const allCurrencies = [
    group?.default_currency,
    group?.additional_currency_1,
    group?.additional_currency_2,
  ].filter(Boolean) as string[]

  const balancesByCurrency: Record<string, Record<string, number>> = {}
  allCurrencies.forEach(currency => {
    balancesByCurrency[currency] = {}
    members.forEach(m => balancesByCurrency[currency][m.id] = 0)
  })

  expenses.forEach(expense => {
    const currency = expense.currency || group?.default_currency || "USD"
    if (!balancesByCurrency[currency]) {
      balancesByCurrency[currency] = {}
      members.forEach(m => balancesByCurrency[currency][m.id] = 0)
    }
    balancesByCurrency[currency][expense.payer_id] = (balancesByCurrency[currency][expense.payer_id] || 0) + Number(expense.amount)
  })

  expenseSplits.forEach(split => {
    // Find the expense to get its currency
    const expense = expenses.find(e => e.id === split.expense_id)
    const currency = expense?.currency || group?.default_currency || "USD"
    if (!balancesByCurrency[currency]) {
      balancesByCurrency[currency] = {}
      members.forEach(m => balancesByCurrency[currency][m.id] = 0)
    }
    balancesByCurrency[currency][split.member_id] = (balancesByCurrency[currency][split.member_id] || 0) - Number(split.amount)
  })

  settlements.forEach(settlement => {
    // Settlements are in default currency
    const currency = group?.default_currency || "USD"
    if (!balancesByCurrency[currency]) {
      balancesByCurrency[currency] = {}
      members.forEach(m => balancesByCurrency[currency][m.id] = 0)
    }
    balancesByCurrency[currency][settlement.sender_id] = (balancesByCurrency[currency][settlement.sender_id] || 0) - Number(settlement.amount)
    balancesByCurrency[currency][settlement.receiver_id] = (balancesByCurrency[currency][settlement.receiver_id] || 0) + Number(settlement.amount)
  })

  const memberBalances = members.map(m => ({
    ...m,
    balances: allCurrencies.reduce((acc, currency) => {
      acc[currency] = balancesByCurrency[currency]?.[m.id] || 0
      return acc
    }, {} as Record<string, number>)
  }))

  // Group expenses by currency for total display
  const totalByCurrency = expenses.reduce((acc, expense) => {
    const currency = expense.currency || "USD"
    if (!acc[currency]) {
      acc[currency] = 0
    }
    acc[currency] += Number(expense.amount)
    return acc
  }, {} as Record<string, number>)

  // Format total string: "S$100.00 + ¥6700.00"
  const totalSpentText = Object.entries(totalByCurrency)
    .map(([currency, amount]) => `${getCurrencySymbol(currency)}${amount.toFixed(2)}`)
    .join(" + ")

  // Group expenses by date
  const expensesByDate = expenses.reduce((acc, expense) => {
    const date = expense.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(expense)
    return acc
  }, {} as Record<string, Expense[]>)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Dialog open={showDeleteMemberDialog} onOpenChange={setShowDeleteMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {memberToDelete?.name} from the group?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Warning:</strong> This will not update or delete any expenses. Any expenses involving this member will remain in the group and may need to be manually adjusted.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteMemberDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember} disabled={saving}>
              {saving ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{group?.name}</h1>
                  {group?.group_code && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      onClick={handleCopyCode}
                      aria-label="Copy group code"
                    >
                      {copiedCode ? <Check className="h-3 w-3 text-green-500" /> : group.group_code}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {members.length} member{members.length !== 1 ? "s" : ""} · Group total: {totalSpentText}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={isPeopleOpen} onOpenChange={setIsPeopleOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200"
                  >
                    <Users className="h-4 w-4 mr-1" />
                    People
                  </Button>
                </DialogTrigger>
                <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white">Group Members</DialogTitle>
                    <DialogDescription className="dark:text-gray-400">
                      Manage members and invite others
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-gray-900 dark:text-white">Invite Link</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={`${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${group?.group_code}`}
                          className="dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyCode}
                          aria-label="Copy invite link"
                        >
                          {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Separator className="dark:border-gray-700" />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-gray-900 dark:text-white">Members ({members.length})</Label>
                        <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" aria-label="Add member">
                              <UserPlus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
                            <DialogHeader>
                              <DialogTitle className="text-gray-900 dark:text-white">Add Member</DialogTitle>
                              <DialogDescription className="dark:text-gray-400">
                                Add a new member to the group
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="add-member-name" className="text-gray-900 dark:text-white">Name</Label>
                                <Input
                                  id="add-member-name"
                                  value={addMemberInput}
                                  onChange={(e) => setAddMemberInput(e.target.value)}
                                  placeholder="Enter member name"
                                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddMemberOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddMember} disabled={saving}>Add Member</Button>
                              </DialogFooter>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {members.map(member => (
                          <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg dark:border-gray-600">
                            {editingMemberId === member.id ? (
                              <div className="flex gap-2 flex-1">
                                <Input
                                  value={memberNameInput}
                                  onChange={(e) => setMemberNameInput(e.target.value)}
                                  className="flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                  aria-label="Member name"
                                />
                                <Button size="sm" onClick={() => handleUpdateMemberName(member.id)} disabled={saving}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                  setEditingMemberId(null)
                                  setMemberNameInput("")
                                }}>Cancel</Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-3">
                                  <MemberAvatar name={member.display_name} />
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{member.display_name || "Guest"}</p>
                                    {member.user_id === group?.owner_id && (
                                      <Badge variant="outline" className="text-xs">Owner</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingMemberId(member.id)
                                      setMemberNameInput(member.display_name)
                                    }}
                                    aria-label={`Edit ${member.display_name}'s name`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {members.length > 1 && member.user_id !== group?.owner_id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDeleteMemberDialog(member.id)}
                                      disabled={saving}
                                      aria-label={`Remove ${member.display_name}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Link href={`/groups/${groupId}/settings`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="expenses" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800">
            <TabsTrigger value="expenses" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Balances</span>
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
                  // Group day expenses by currency
                  const dayTotalByCurrency = dayExpenses.reduce((acc, e) => {
                    const currency = e.currency || "USD"
                    if (!acc[currency]) {
                      acc[currency] = 0
                    }
                    acc[currency] += Number(e.amount)
                    return acc
                  }, {} as Record<string, number>)

                  const dayTotalText = Object.entries(dayTotalByCurrency)
                    .map(([currency, amount]) => `${getCurrencySymbol(currency)}${amount.toFixed(2)}`)
                    .join(" + ")

                  return (
                    <div key={date}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm text-gray-500 dark:text-gray-400">
                          {new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {dayTotalText}
                        </p>
                      </div>
                      <Card className="dark:bg-gray-800 dark:border-gray-700">
                        <CardContent className="p-0">
                          {dayExpenses.map((expense, idx) => {
                            const expensePayer = members.find(m => m.id === expense.payer_id)
                            const expenseSplitMembers = expenseSplits
                              .filter(s => s.expense_id === expense.id)
                              .map(s => members.find(m => m.id === s.member_id))
                              .filter(Boolean) as GroupMember[]
                            
                            const involvedMembers = expenseSplitMembers.length > 0 ? expenseSplitMembers : members
                            const involvedCount = involvedMembers.length
                            const perPersonAmount = expense.split_type === "even" 
                              ? Number(expense.amount) / involvedCount
                              : null

                            return (
                              <div key={expense.id}>
                                <Link href={`/groups/${groupId}/expense/${expense.id}/edit`}>
                                  <div className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                    <span className="text-2xl">{getCategoryEmoji(expense.description)}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 dark:text-white truncate">{expense.description}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="flex -space-x-2">
                                          {involvedMembers.slice(0, 5).map((member, i) => (
                                            <MemberAvatar 
                                              key={member.id} 
                                              name={member.display_name} 
                                              size="sm" 
                                              className="ring-2 ring-white dark:ring-gray-800"
                                            />
                                          ))}
                                          {involvedCount > 5 && (
                                            <div className="size-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 ring-2 ring-white dark:ring-gray-800">
                                              +{involvedCount - 5}
                                            </div>
                                          )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                          {expensePayer?.display_name || "Unknown"} paid · {expense.split_type}
                                          {perPersonAmount !== null && (
                                            <span className="ml-1 text-gray-400 dark:text-gray-500">
                                              ({getCurrencySymbol(expense.currency || "USD")}{perPersonAmount.toFixed(2)}/person)
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="font-semibold text-gray-900 dark:text-white">
                                        {getCurrencySymbol(expense.currency || "USD")}
                                        {Number(expense.amount).toFixed(2)}
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
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b dark:border-gray-700">
                        <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Member</th>
                        {allCurrencies.map(currency => (
                          <th key={currency} className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                            {currency}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {memberBalances.map(member => (
                        <tr key={member.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <MemberAvatar name={member.display_name} size="sm" />
                              <span className="text-gray-900 dark:text-white">{member.display_name || "Guest"}</span>
                            </div>
                          </td>
                          {allCurrencies.map(currency => {
                            const balance = member.balances[currency] || 0
                            const isPositive = balance >= 0
                            return (
                              <td key={currency} className="text-right py-3 px-4">
                                <span className={`font-semibold ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                  {isPositive ? "+" : ""}{getCurrencySymbol(currency)}{balance.toFixed(2)}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Simplified debts view - shows debts in default currency only */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Who Owes Whom</CardTitle>
                <CardDescription className="dark:text-gray-400">Based on {group?.default_currency} balance</CardDescription>
              </CardHeader>
              <CardContent>
                {memberBalances.filter(m => (m.balances[group?.default_currency || "USD"] || 0) < -0.01).map(debtor => {
                  const creditor = memberBalances.find(m => (m.balances[group?.default_currency || "USD"] || 0) > 0.01)
                  if (!creditor) return null
                  
                  const defaultCurrency = group?.default_currency || "USD"
                  const amount = Math.min(Math.abs(debtor.balances[defaultCurrency] || 0), creditor.balances[defaultCurrency] || 0)
                  if (amount < 0.01) return null
                  
                  return (
                    <div key={`${debtor.id}-${creditor.id}`} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 dark:text-white">{debtor.display_name}</span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{creditor.display_name}</span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {getCurrencySymbol(defaultCurrency)}{amount.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
                {memberBalances.every(m => Math.abs(m.balances[group?.default_currency || "USD"] || 0) < 0.01) && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">All settled up!</p>
                )}
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

        </Tabs>
      </main>
    </div>
  )
}
