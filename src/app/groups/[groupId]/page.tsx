"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const formatAmount = (amount: number): string => {
  if (Number.isInteger(amount)) {
    return amount.toString()
  }
  return amount.toFixed(2).replace(/\.?0+$/, "")
}
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
  Copy,
  Check,
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Home,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useGroup } from "@/hooks/useGroup"
import { getCurrencySymbol, CURRENCIES, getCategoryEmoji } from "@/lib/constants"
import type { Group, GroupMember, Expense, ExpenseSplit, Settlement } from "@/lib/supabase/types"
import { MemberAvatar } from "@/components/ui/avatar"

export default function GroupDashboardPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { verifyPin, isPinVerified, clearPinVerification } = useGroup()

  // Get tab from URL or default to "expenses"
  const currentTab = searchParams.get("tab") || "expenses"

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifyingPin, setVerifyingPin] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [group, setGroup] = useState<Group | null>(null)
  const [groupBasicInfo, setGroupBasicInfo] = useState<{ name: string; group_code: string } | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [expenseSplits, setExpenseSplits] = useState<ExpenseSplit[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showImageZoom, setShowImageZoom] = useState(false)
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null)

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
  const [showSettlementDetails, setShowSettlementDetails] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [showDeleteSettlementDialog, setShowDeleteSettlementDialog] = useState(false)
  const [settlementToDelete, setSettlementToDelete] = useState<Settlement | null>(null)
  const [showDeleteGroupDialog, setShowDeleteGroupDialog] = useState(false)

  useEffect(() => {
    // Fetch basic group info for PIN screen
    fetchBasicGroupInfo()

    if (isPinVerified(groupId)) {
      fetchGroupData()
    } else {
      setLoading(false)
    }
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

    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      // First get all expense IDs for this group
      const { data: expenseIdsData } = await supabase.from("expenses").select("id").eq("group_id", groupId)
      const expenseIds = expenseIdsData?.map((e: { id: string }) => e.id) || []
      
      // Then fetch all data including splits filtered by expense IDs
      const [groupRes, membersRes, expensesRes, settlementsRes, splitsRes] = await Promise.all([
        supabase.from("groups").select("*").eq("id", groupId).single(),
        supabase.from("group_members").select("*").eq("group_id", groupId),
        supabase.from("expenses").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
        supabase.from("settlements").select("*").eq("group_id", groupId).order("date", { ascending: false }),
        expenseIds.length > 0 
          ? supabase.from("expense_splits").select("*").in("expense_id", expenseIds)
          : Promise.resolve({ data: [], error: null })
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
      // Stay on balances tab
      router.push(`/groups/${groupId}?tab=balances`)
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
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      // Check if member already exists
      const { data: existingMember } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle()
      
      if (existingMember) {
        toast.error("You are already a member of this group")
        setSaving(false)
        return
      }
      
      const { error } = await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: userId,
        display_name: addMemberInput.trim()
      })
      
      if (error) {
        console.error("Error adding member:", error)
        toast.error(error.message)
      } else {
        toast.success("Member added")
        setIsAddMemberOpen(false)
        setAddMemberInput("")
        fetchGroupData()
      }
    } catch (err) {
      console.error("Exception adding member:", err)
      toast.error("Failed to add member. Please try again.")
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
    if (!showDeleteGroupDialog) return
    setSaving(true)
    const { error } = await supabase.from("groups").delete().eq("id", groupId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Group deleted")
      router.push("/")
    }
    setSaving(false)
    setShowDeleteGroupDialog(false)
  }

  const handleDeleteSettlement = async () => {
    if (!settlementToDelete) return
    setSaving(true)
    const { error } = await supabase
      .from("settlements")
      .delete()
      .eq("id", settlementToDelete.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Settlement deleted")
      setShowDeleteSettlementDialog(false)
      setSettlementToDelete(null)
      fetchGroupData()
    }
    setSaving(false)
  }

  const openSettlementDetails = (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    setShowSettlementDetails(true)
  }

  const openDeleteSettlementDialog = (settlement: Settlement) => {
    setSettlementToDelete(settlement)
    setShowDeleteSettlementDialog(true)
  }

  const getOrigin = () => {
    if (typeof window !== "undefined") {
      return window.location.origin
    }
    return process.env.NEXT_PUBLIC_APP_URL || ""
  }

  const handleCopyCode = async (copyFullUrl: boolean = false) => {
    if (group?.group_code) {
      const textToCopy = copyFullUrl 
        ? `${getOrigin()}/groups/join?code=${group.group_code}`
        : group.group_code
      await navigator.clipboard.writeText(textToCopy)
      setCopiedCode(true)
      toast.success(copyFullUrl ? "Invite link copied!" : "Group code copied!")
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  // Calculate balances by currency
  // Each expense: payer gets +amount, each split member gets -their share
  // For "even" splits without split records: all members split equally
  
  const allCurrencies = [
    group?.default_currency,
    group?.additional_currency_1,
    group?.additional_currency_2,
  ].filter(Boolean) as string[]

  const currentBalancesByCurrency: Record<string, Record<string, number>> = {}
  const netBalancesByCurrency: Record<string, Record<string, number>> = {}
  
  // Initialize balances for all currencies
  allCurrencies.forEach(currency => {
    currentBalancesByCurrency[currency] = {}
    netBalancesByCurrency[currency] = {}
    members.forEach(m => {
      currentBalancesByCurrency[currency][m.id] = 0
      netBalancesByCurrency[currency][m.id] = 0
    })
  })

  // Process each expense (both current and net balances)
  expenses.forEach(expense => {
    const currency = expense.currency || group?.default_currency || "USD"
    
    // Ensure currency exists in balances
    if (!currentBalancesByCurrency[currency]) {
      currentBalancesByCurrency[currency] = {}
      netBalancesByCurrency[currency] = {}
      members.forEach(m => {
        currentBalancesByCurrency[currency][m.id] = 0
        netBalancesByCurrency[currency][m.id] = 0
      })
    }
    
    // Credit the payer the full amount (they paid, so others owe them)
    const currentPayerBalance = currentBalancesByCurrency[currency][expense.payer_id] || 0
    const netPayerBalance = netBalancesByCurrency[currency][expense.payer_id] || 0
    currentBalancesByCurrency[currency][expense.payer_id] = currentPayerBalance + Number(expense.amount)
    netBalancesByCurrency[currency][expense.payer_id] = netPayerBalance + Number(expense.amount)
    
    // Get splits for this specific expense
    const expenseSpecificSplits = expenseSplits.filter(s => s.expense_id === expense.id)
    
    if (expenseSpecificSplits.length > 0) {
      // Use recorded splits - debit each member their recorded share
      expenseSpecificSplits.forEach(split => {
        const currentMemberBalance = currentBalancesByCurrency[currency][split.member_id] || 0
        const netMemberBalance = netBalancesByCurrency[currency][split.member_id] || 0
        currentBalancesByCurrency[currency][split.member_id] = currentMemberBalance - Number(split.amount)
        netBalancesByCurrency[currency][split.member_id] = netMemberBalance - Number(split.amount)
      })
    } else if (expense.split_type === "even") {
      // Even split without records - debit all members equally
      const perPersonAmount = Number(expense.amount) / members.length
      members.forEach(m => {
        const currentMemberBalance = currentBalancesByCurrency[currency][m.id] || 0
        const netMemberBalance = netBalancesByCurrency[currency][m.id] || 0
        currentBalancesByCurrency[currency][m.id] = currentMemberBalance - perPersonAmount
        netBalancesByCurrency[currency][m.id] = netMemberBalance - perPersonAmount
      })
    }
    // For percentage/specific splits without records, no one is debited (edge case)
  })

  // Process settlements ONLY in net balances (current balance = expenses only)
  settlements.forEach(settlement => {
    const currency = group?.default_currency || "USD"
    
    if (!netBalancesByCurrency[currency]) {
      netBalancesByCurrency[currency] = {}
      members.forEach(m => netBalancesByCurrency[currency][m.id] = 0)
    }
    
    const senderBalance = netBalancesByCurrency[currency][settlement.sender_id] || 0
    const receiverBalance = netBalancesByCurrency[currency][settlement.receiver_id] || 0
    
    // Sender paid money, so their debt decreases (balance increases towards positive)
    netBalancesByCurrency[currency][settlement.sender_id] = senderBalance + Number(settlement.amount)
    // Receiver received money, so what they're owed decreases (balance decreases towards negative)
    netBalancesByCurrency[currency][settlement.receiver_id] = receiverBalance - Number(settlement.amount)
  })

  const memberBalances = members.map(m => ({
    ...m,
    balances: allCurrencies.reduce((acc, currency) => {
      acc[currency] = currentBalancesByCurrency[currency]?.[m.id] || 0
      return acc
    }, {} as Record<string, number>)
  }))

  // Net balances include settlements (what's still owed after settlements)
  const netMemberBalances = members.map(m => ({
    ...m,
    balances: allCurrencies.reduce((acc, currency) => {
      acc[currency] = netBalancesByCurrency[currency]?.[m.id] || 0
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
    .map(([currency, amount]) => `${getCurrencySymbol(currency)}${formatAmount(amount)}`)
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

      <Dialog open={showImageZoom} onOpenChange={setShowImageZoom}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-transparent border-none">
          <DialogHeader className="absolute top-2 right-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowImageZoom(false)}
              className="bg-black/50 hover:bg-black/70 rounded-full text-white"
            >
              <X className="h-6 w-6" />
            </Button>
          </DialogHeader>
          {zoomedImageUrl && (
            <div className="flex items-center justify-center min-h-[80vh] p-4">
              <img
                src={zoomedImageUrl}
                alt="Receipt zoomed"
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settlement Details Dialog */}
      <Dialog open={showSettlementDetails} onOpenChange={setShowSettlementDetails}>
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Settlement Details</DialogTitle>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">From</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {members.find(m => m.id === selectedSettlement.sender_id)?.display_name || "Unknown"}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">To</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {members.find(m => m.id === selectedSettlement.receiver_id)?.display_name || "Unknown"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Amount</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {getCurrencySymbol(group?.default_currency || "USD")}
                    {Number(selectedSettlement.amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {new Date(selectedSettlement.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </p>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedSettlement.created_at
                    ? new Date(selectedSettlement.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true
                      })
                    : "N/A"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                setShowSettlementDetails(false)
                openDeleteSettlementDialog(selectedSettlement!)
              }}
              className="flex-1"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button variant="outline" onClick={() => setShowSettlementDetails(false)} className="flex-1">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Settlement Confirmation Dialog */}
      <Dialog open={showDeleteSettlementDialog} onOpenChange={setShowDeleteSettlementDialog}>
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Delete Settlement</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Are you sure you want to delete this settlement? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {settlementToDelete && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Settlement details:</p>
              <p className="text-gray-900 dark:text-white">
                {members.find(m => m.id === settlementToDelete.sender_id)?.display_name} paid{" "}
                {getCurrencySymbol(group?.default_currency || "USD")}{formatAmount(Number(settlementToDelete.amount))} to{" "}
                {members.find(m => m.id === settlementToDelete.receiver_id)?.display_name}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteSettlementDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSettlement} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation Dialog */}
      <Dialog open={showDeleteGroupDialog} onOpenChange={setShowDeleteGroupDialog}>
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Delete Group</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Are you sure you want to delete this group? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Warning:</strong> This will permanently delete the group, all members, expenses, and settlements. This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteGroupDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteGroup} disabled={saving}>
              {saving ? "Deleting..." : "Delete Group"}
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
                      onClick={() => handleCopyCode()}
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
                    <Users className="h-4 w-4" />
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
                      <a
                        href={`${getOrigin()}/groups/join?code=${group?.group_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm break-all"
                      >
                        <span className="flex-1">{`${getOrigin()}/groups/join?code=${group?.group_code}`}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-8 w-8 p-0"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleCopyCode(true)
                          }}
                          aria-label="Copy invite link"
                        >
                          {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </a>
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
                                      setMemberNameInput(member.display_name || "")
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
        <Tabs defaultValue={currentTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800">
            <TabsTrigger value="expenses" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <Receipt className="h-4 w-4" />
              <span>Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <Wallet className="h-4 w-4" />
              <span>Balances</span>
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
                    .map(([currency, amount]) => `${getCurrencySymbol(currency)}${formatAmount(amount)}`)
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
                            
                            // Get unique members from expense splits for this expense
                            const expenseSplitMemberIds = expenseSplits
                              .filter(s => s.expense_id === expense.id)
                              .map(s => s.member_id)
                            const uniqueMemberIds = [...new Set(expenseSplitMemberIds)]
                            
                            // Use split members if available, otherwise use all group members
                            const involvedMembers = uniqueMemberIds.length > 0 
                              ? uniqueMemberIds.map(id => members.find(m => m.id === id)).filter(Boolean) as GroupMember[]
                              : members
                            const involvedCount = involvedMembers.length
                            const perPersonAmount = expense.split_type === "even" 
                              ? Number(expense.amount) / involvedCount
                              : null

                            return (
                              <div key={expense.id}>
                                <Link href={`/groups/${groupId}/expense/${expense.id}/edit`}>
                                  <div className="p-4 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                    <span className="text-2xl">{getCategoryEmoji(expense.description)}</span>
                                    <div className="flex-1 min-w-0 space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">{expense.description}</p>
                                        <p className="font-semibold text-gray-900 dark:text-white shrink-0">
                                          {getCurrencySymbol(expense.currency || "USD")}
                                          {formatAmount(Number(expense.amount))}
                                        </p>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 w-full">
                                          {expensePayer?.display_name || "Unknown"} paid · {expense.split_type}
                                          {perPersonAmount !== null && (
                                            <span className="ml-1 text-gray-400 dark:text-gray-500">
                                              ({getCurrencySymbol(expense.currency || "USD")}{formatAmount(perPersonAmount)}/person)
                                            </span>
                                          )}
                                          {expense.created_at && (
                                            <span className="ml-1 text-gray-400 dark:text-gray-500">
                                              · {new Date(expense.created_at).toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true })}
                                            </span>
                                          )}
                                        </p>
                                        {expense.receipt_url && (
                                          <div 
                                            className="shrink-0 cursor-pointer"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              setZoomedImageUrl(expense.receipt_url)
                                              setShowImageZoom(true)
                                            }}
                                          >
                                            <img
                                              src={expense.receipt_url}
                                              alt="Receipt"
                                              className="h-10 w-10 object-cover rounded-md border border-gray-200 dark:border-gray-600"
                                            />
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap">
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
                                      </div>
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
                <CardTitle className="text-gray-900 dark:text-white">Current Balances</CardTitle>
                <CardDescription className="dark:text-gray-400">Based on expenses (settlements included)</CardDescription>
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
                      {netMemberBalances.map(member => (
                        <tr key={member.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <MemberAvatar name={member.display_name} size="sm" />
                              <span className="text-gray-900 dark:text-white">{member.display_name || "Guest"}</span>
                            </div>
                          </td>
                          {allCurrencies.map(currency => {
                            const balance = member.balances[currency] || 0
                            const isPositive = balance > 0.01
                            const isNegative = balance < -0.01
                            return (
                              <td key={currency} className="text-right py-3 px-4">
                                <span className={`font-semibold ${
                                  isPositive 
                                    ? "text-green-600 dark:text-green-400" 
                                    : isNegative 
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-gray-400 dark:text-gray-500"
                                }`}>
                                  {isPositive ? "+" : ""}{getCurrencySymbol(currency)}{formatAmount(balance)}
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

            {/* Debts view - simplified or raw based on group setting */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-gray-900 dark:text-white">Who Owes Whom</CardTitle>
                    <CardDescription className="dark:text-gray-400">
                      {group?.simplify_debts 
                        ? "Simplified debts - minimum transfers needed" 
                        : "Individual debts based on each expense"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {group?.simplify_debts ? "Simplified" : "Individual"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={group?.simplify_debts}
                      onClick={handleToggleSimplifyDebts}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        group?.simplify_debts ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                      aria-label="Toggle simplify debts"
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          group?.simplify_debts ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Show debts for each currency
                  return allCurrencies.map(currency => {
                    // When simplify_debts is OFF, show raw individual debts from expenses
                    // When simplify_debts is ON, show simplified/minimized debts
                    
                    let debts: Array<{from: string, to: string, amount: number, fromId: string, toId: string}>
                    
                    if (!group?.simplify_debts) {
                      // Raw unsimplified view: calculate individual debts from each expense
                      const debtMap: Record<string, Record<string, number>> = {}
                      
                      // Initialize debt map
                      members.forEach(m => {
                        debtMap[m.id] = {}
                        members.forEach(m2 => {
                          if (m.id !== m2.id) {
                            debtMap[m.id][m2.id] = 0
                          }
                        })
                      })
                      
                      // Calculate debts from each expense
                      expenses.forEach(expense => {
                        const payerId = expense.payer_id
                        const expenseCurrency = expense.currency || group?.default_currency || "USD"
                        
                        // Only process expenses in this currency
                        if (expenseCurrency !== currency) return
                        
                        // Get splits for this expense
                        const expenseSpecificSplits = expenseSplits.filter(s => s.expense_id === expense.id)
                        const expenseAmount = Number(expense.amount)
                        
                        if (expenseSpecificSplits.length > 0) {
                          // Use recorded splits
                          expenseSpecificSplits.forEach(split => {
                            if (split.member_id !== payerId) {
                              debtMap[split.member_id][payerId] = (debtMap[split.member_id][payerId] || 0) + Number(split.amount)
                            }
                          })
                        } else if (expense.split_type === "even") {
                          // Even split
                          const perPersonAmount = expenseAmount / members.length
                          members.forEach(m => {
                            if (m.id !== payerId) {
                              debtMap[m.id][payerId] = (debtMap[m.id][payerId] || 0) + perPersonAmount
                            }
                          })
                        }
                        // For percentage/specific splits without records, skip (edge case)
                      })
                      
                      // Convert to debts array (only include non-zero amounts)
                      debts = []
                      members.forEach(fromMember => {
                        members.forEach(toMember => {
                          if (fromMember.id !== toMember.id) {
                            const amount = debtMap[fromMember.id]?.[toMember.id] || 0
                            if (amount > 0.01) {
                              debts.push({
                                from: fromMember.display_name || "Guest",
                                to: toMember.display_name || "Guest",
                                amount,
                                fromId: fromMember.id,
                                toId: toMember.id
                              })
                            }
                          }
                        })
                      })
                    } else {
                      // Simplified view - use greedy algorithm with net balances
                      // Create lists of debtors and creditors for this currency using net balances
                      const debtors = netMemberBalances
                        .filter(m => (m.balances[currency] || 0) < -0.01)
                        .map(m => ({ member: m, amount: Math.abs(m.balances[currency]) }))
                        .sort((a, b) => b.amount - a.amount)
                      
                      const creditors = netMemberBalances
                        .filter(m => (m.balances[currency] || 0) > 0.01)
                        .map(m => ({ member: m, amount: m.balances[currency] }))
                        .sort((a, b) => b.amount - a.amount)
                      
                      if (debtors.length === 0 || creditors.length === 0) {
                        return null
                      }
                      
                      // Calculate simplified debts using greedy algorithm
                      debts = []
                      let remainingDebtors = [...debtors]
                      let remainingCreditors = [...creditors]
                      
                      while (remainingDebtors.length > 0 && remainingCreditors.length > 0) {
                        const debtor = remainingDebtors[0]
                        const creditor = remainingCreditors[0]
                        
                        const amount = Math.min(debtor.amount, creditor.amount)
                        
                        if (amount > 0.01) {
                          debts.push({
                            from: debtor.member.display_name || "Guest",
                            to: creditor.member.display_name || "Guest",
                            amount,
                            fromId: debtor.member.id,
                            toId: creditor.member.id
                          })
                        }
                        
                        debtor.amount -= amount
                        creditor.amount -= amount
                        
                        if (debtor.amount < 0.01) {
                          remainingDebtors.shift()
                        }
                        if (creditor.amount < 0.01) {
                          remainingCreditors.shift()
                        }
                      }
                    }
                    
                    if (debts.length === 0) {
                      return null
                    }
                    
                    return (
                      <div key={currency} className="mb-6 last:mb-0">
                        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">{currency}</h3>
                        <div className="space-y-2">
                          {debts.map((debt, idx) => (
                            <div key={`${currency}-${idx}`} className="flex items-center justify-between py-2">
                              <div className="flex items-center gap-2">
                                <MemberAvatar name={debt.from} size="sm" />
                                <span className="text-gray-900 dark:text-white">{debt.from}</span>
                                <ArrowRight className="h-4 w-4 text-gray-400" />
                                <MemberAvatar name={debt.to} size="sm" />
                                <span className="text-gray-900 dark:text-white">{debt.to}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {getCurrencySymbol(currency)}{formatAmount(debt.amount)}
                                </span>
                                <Link
                                  href={`/groups/${groupId}/settle?senderId=${debt.fromId}&receiverId=${debt.toId}&amount=${debt.amount}&currency=${currency}`}
                                >
                                  <Button size="sm" variant="outline" className="h-8">
                                    Settle
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }).filter(Boolean)
                })()}
                {allCurrencies.every(currency => {
                  // Check based on current mode
                  if (!group?.simplify_debts) {
                    // For unsimplified, check if there are any expenses in this currency
                    const hasExpenses = expenses.some(e => (e.currency || group?.default_currency || "USD") === currency)
                    return !hasExpenses
                  } else {
                    // For simplified, check net balances
                    const debtors = netMemberBalances.filter(m => (m.balances[currency] || 0) < -0.01)
                    const creditors = netMemberBalances.filter(m => (m.balances[currency] || 0) > 0.01)
                    return debtors.length === 0 || creditors.length === 0
                  }
                }) && (
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
                        <div
                          key={settlement.id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                          onClick={() => openSettlementDetails(settlement)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              openSettlementDetails(settlement)
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <MemberAvatar name={sender?.display_name || null} size="sm" />
                            <span className="font-medium text-gray-900 dark:text-white">{sender?.display_name}</span>
                            <span className="text-gray-500 dark:text-gray-400"> paid </span>
                            <MemberAvatar name={receiver?.display_name || null} size="sm" />
                            <span className="font-medium text-gray-900 dark:text-white">{receiver?.display_name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {getCurrencySymbol(group?.default_currency || "USD")}{formatAmount(Number(settlement.amount))}
                              </span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(settlement.date).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                openDeleteSettlementDialog(settlement)
                              }}
                              aria-label="Delete settlement"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
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
