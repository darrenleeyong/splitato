"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useGroup } from "@/hooks/useGroup"

export default function JoinGroupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { setPinVerified } = useGroup()
  const [loading, setLoading] = useState(false)
  const [groupCode, setGroupCode] = useState("")
  const [pin, setPin] = useState("")
  const [foundGroup, setFoundGroup] = useState<{id: string, name: string} | null>(null)
  const [showPinInput, setShowPinInput] = useState(false)

  // Auto-fill group code from URL query param on mount
  useEffect(() => {
    const codeFromUrl = searchParams.get("code")
    if (codeFromUrl) {
      setGroupCode(codeFromUrl.toUpperCase())
      // Automatically find the group
      handleFindGroup(null, codeFromUrl.toUpperCase())
    }
  }, [searchParams])

  const handleFindGroup = async (e: React.FormEvent | null, codeOverride?: string) => {
    if (e) {
      e.preventDefault()
    }
    
    const code = (codeOverride || groupCode).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
    
    if (code.length !== 6) {
      return
    }

    setLoading(true)

    try {
      // Find group by group_code
      const { data: groups, error: groupError } = await supabase
        .from("groups")
        .select("id, name")
        .eq("group_code", code)

      if (groupError || !groups || groups.length === 0) {
        toast.error("No group found with this code")
        setLoading(false)
        return
      }

      const group = groups[0]
      setFoundGroup(group)
      setShowPinInput(true)
      setLoading(false)
    } catch (error) {
      toast.error("Failed to find group")
      setLoading(false)
    }
  }

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!foundGroup) return

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast.error("PIN must be exactly 4 digits")
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Verify PIN before joining
      const { data: group, error: pinError } = await supabase
        .from("groups")
        .select("id, name, pin_code")
        .eq("id", foundGroup.id)
        .single()

      if (pinError || !group) {
        toast.error("Group not found")
        setLoading(false)
        return
      }

      if (group.pin_code !== pin) {
        toast.error("Invalid PIN")
        setLoading(false)
        return
      }

      // PIN verified, now join the group
      if (user) {
        const { data: existingMember } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", group.id)
          .eq("user_id", user.id)
          .single()

        if (existingMember) {
          setPinVerified(group.id)
          router.push(`/groups/${group.id}`)
          router.refresh()
          setLoading(false)
          return
        }

        // Add user as member
        const { error: memberError } = await supabase
          .from("group_members")
          .insert({
            group_id: group.id,
            user_id: user.id,
            display_name: user.email?.split("@")[0] || "You",
          })

        if (memberError) {
          toast.error(memberError.message)
          setLoading(false)
          return
        }

        setPinVerified(group.id)
        toast.success(`Joined ${group.name}!`)
        router.push(`/groups/${group.id}`)
        router.refresh()
      } else {
        // Guest user - join straightaway without requiring name
        const guestId = `guest_${Date.now()}`

        const { error: memberError } = await supabase
          .from("group_members")
          .insert({
            group_id: group.id,
            user_id: guestId,
            display_name: "Guest",
          })

        if (memberError) {
          toast.error(memberError.message)
          setLoading(false)
          return
        }

        setPinVerified(group.id)
        toast.success(`Joined ${group.name}!`)
        router.push(`/groups/${group.id}`)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to join group")
      setLoading(false)
    }
  }

  if (showPinInput && foundGroup) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 pt-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" className="p-0 h-8 w-8" onClick={() => {
                setShowPinInput(false)
                setFoundGroup(null)
                setPin("")
              }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle>Enter PIN</CardTitle>
            </div>
            <CardDescription>Found: {foundGroup.name}. Enter the 4-digit PIN to join.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">4-Digit PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="Enter 4-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Join Group"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 pt-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <CardTitle>Join Group</CardTitle>
          </div>
          <CardDescription>Enter the 6-character group code to join a group</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFindGroup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupCode">Group Code</Label>
              <Input
                id="groupCode"
                type="text"
                inputMode="text"
                maxLength={6}
                placeholder="Enter 6-character code"
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value.toUpperCase())}
                required
                className="text-center text-lg tracking-widest font-mono"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Finding..." : "Find Group"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
