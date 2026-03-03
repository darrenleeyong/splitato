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
import { ArrowLeft, Trash2, UserPlus, Shield, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { CURRENCIES } from "@/lib/constants"
import type { Group, GroupMember } from "@/lib/supabase/types"

const settingsSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  defaultCurrency: z.string(),
  pin: z.string().optional(),
  confirmPin: z.string().optional(),
})

type SettingsFormData = z.infer<typeof settingsSchema>

export default function SettingsPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editingCurrency, setEditingCurrency] = useState(false)
  const [editingPin, setEditingPin] = useState(false)
  const [memberExpenseCounts, setMemberExpenseCounts] = useState<Record<string, number>>({})
  const [copiedCode, setCopiedCode] = useState(false)
  const [addingCurrency, setAddingCurrency] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      defaultCurrency: "USD",
      pin: "",
      confirmPin: "",
    },
  })

  const watchPin = watch("pin")
  const watchConfirmPin = watch("confirmPin")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)

    const [groupRes, membersRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("group_members").select("*").eq("group_id", groupId),
    ])

    setGroup(groupRes.data)
    setMembers(membersRes.data || [])
    setIsOwner(groupRes.data?.owner_id === user?.id)

    if (groupRes.data) {
      setValue("name", groupRes.data.name)
      setValue("defaultCurrency", groupRes.data.default_currency)
    }

    // Get expense counts per member
    const expenses = await supabase.from("expenses").select("payer_id").eq("group_id", groupId)
    const counts: Record<string, number> = {}
    expenses.data?.forEach(e => {
      counts[e.payer_id] = (counts[e.payer_id] || 0) + 1
    })
    setMemberExpenseCounts(counts)
  }

  const onSubmit = async (data: SettingsFormData) => {
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
      const updateData: Partial<Group> = {
        name: data.name,
        default_currency: data.defaultCurrency,
      }

      if (data.pin) {
        updateData.pin_code = data.pin
      }

      const { error } = await supabase
        .from("groups")
        .update(updateData)
        .eq("id", groupId)

      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      toast.success("Settings saved!")
      setEditingName(false)
      setEditingCurrency(false)
      setEditingPin(false)
      setValue("pin", "")
      setValue("confirmPin", "")
      fetchData()
    } catch (error) {
      toast.error("Failed to save settings")
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
        setLoading(false)
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

  const handleCopyGroupCode = async () => {
    if (group?.group_code) {
      await navigator.clipboard.writeText(group.group_code)
      setCopiedCode(true)
      toast.success("Group code copied!")
      setTimeout(() => setCopiedCode(false), 2000)
    }
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
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Group Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                {editingName ? (
                  <div className="flex gap-2">
                    <Input {...register("name")} />
                    <Button type="button" variant="outline" onClick={() => {
                      setEditingName(false)
                      reset({ name: group?.name || "" })
                    }}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{group?.name}</p>
                    {isOwner && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingName(true)}>
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Group Code</Label>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-lg tracking-widest">{group?.group_code}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={handleCopyGroupCode}>
                    {copiedCode ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Share this code with others to join the group</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Default Currency</Label>
                {editingCurrency ? (
                  <div className="flex gap-2">
                    <Select
                      value={watch("defaultCurrency")}
                      onValueChange={(v) => setValue("defaultCurrency", v)}
                    >
                      <SelectTrigger>
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
                    <Button type="button" variant="outline" onClick={() => {
                      setEditingCurrency(false)
                      reset({ defaultCurrency: group?.default_currency || "USD" })
                    }}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{group?.default_currency}</p>
                    {isOwner && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCurrency(true)}>
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Currencies</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 border rounded-md">
                    <span className="font-medium">{group?.default_currency}</span>
                    <Badge variant="outline">Main</Badge>
                  </div>
                  {group?.additional_currency_1 && (
                    <div className="flex items-center justify-between p-2 border rounded-md">
                      <span className="font-medium">{group?.additional_currency_1}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={async () => {
                          await supabase.from("groups").update({ additional_currency_1: null }).eq("id", groupId)
                          fetchData()
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                  {group?.additional_currency_2 && (
                    <div className="flex items-center justify-between p-2 border rounded-md">
                      <span className="font-medium">{group?.additional_currency_2}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={async () => {
                          await supabase.from("groups").update({ additional_currency_2: null }).eq("id", groupId)
                          fetchData()
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                  {!group?.additional_currency_1 && !group?.additional_currency_2 && isOwner && !addingCurrency && (
                    <Button variant="outline" size="sm" onClick={() => setAddingCurrency(true)}>
                      Add Currency
                    </Button>
                  )}
                  {addingCurrency && (
                    <Select
                      onValueChange={async (value) => {
                        if (!group?.additional_currency_1) {
                          await supabase.from("groups").update({ additional_currency_1: value }).eq("id", groupId)
                        } else if (!group?.additional_currency_2) {
                          await supabase.from("groups").update({ additional_currency_2: value }).eq("id", groupId)
                        }
                        setAddingCurrency(false)
                        fetchData()
                      }}
                    >
                      <SelectTrigger>
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

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  PIN Code
                </Label>
                {editingPin ? (
                  <div className="space-y-2">
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="New 4-digit PIN"
                      {...register("pin")}
                    />
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="Confirm new PIN"
                      {...register("confirmPin")}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading}>Save PIN</Button>
                      <Button type="button" variant="outline" onClick={() => {
                        setEditingPin(false)
                        setValue("pin", "")
                        setValue("confirmPin", "")
                      }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="font-medium">••••</p>
                    {isOwner && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPin(true)}>
                        Change
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {(editingName || editingCurrency) && (
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members ({members.length})</CardTitle>
            <CardDescription>Manage group members</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map(member => {
              const expenseCount = memberExpenseCounts[member.id] || 0
              return (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-medium">
                        {member.display_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{member.display_name}</p>
                      <p className="text-sm text-gray-500">
                        {expenseCount} expense{expenseCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {isOwner && member.user_id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            {isOwner && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={async () => {
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
                      setLoading(false)
                      return
                    }

                    toast.success("Group deleted")
                    router.push("/")
                  } catch (error) {
                    toast.error("Failed to delete group")
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
              >
                Delete Group
              </Button>
            )}
            {!isOwner && (
              <p className="text-gray-500 text-center py-2">
                Only the group owner can delete this group
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
