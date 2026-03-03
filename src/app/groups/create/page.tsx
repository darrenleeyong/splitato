"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CURRENCIES } from "@/lib/constants"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft, AlertTriangle, Plus } from "lucide-react"

const generateGroupCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

type Step = "details" | "pin" | "confirm"

export default function CreateGroupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>("details")
  const [isGuest, setIsGuest] = useState(false)

  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [showAdditionalCurrency1, setShowAdditionalCurrency1] = useState(false)
  const [additionalCurrency1, setAdditionalCurrency1] = useState<string | undefined>(undefined)
  const [showAdditionalCurrency2, setShowAdditionalCurrency2] = useState(false)
  const [additionalCurrency2, setAdditionalCurrency2] = useState<string | undefined>(undefined)
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsGuest(true)
    }
  }

  const availableCurrencies = CURRENCIES.filter(
    c => c.code !== currency && c.code !== (additionalCurrency1 || "")
  )

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Group name is required")
      return
    }
    setStep("pin")
  }

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast.error("PIN must be exactly 4 digits")
      return
    }
    setStep("confirm")
  }

  const handleCreateGroup = async () => {
    if (pin !== confirmPin) {
      toast.error("PINs do not match")
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const groupCode = generateGroupCode()

      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name,
          default_currency: currency,
          additional_currency_1: additionalCurrency1 || null,
          additional_currency_2: additionalCurrency2 || null,
          group_code: groupCode,
          pin_code: pin,
          owner_id: user?.id || `guest_${Date.now()}`,
        })
        .select()
        .single()

      if (groupError) {
        console.error("Group insert error:", groupError)
        if (groupError.message.includes("group_code")) {
          const newCode = generateGroupCode()
          const { data: retryGroup, error: retryError } = await supabase
            .from("groups")
            .insert({
              name,
              default_currency: currency,
              additional_currency_1: additionalCurrency1 || null,
              additional_currency_2: additionalCurrency2 || null,
              group_code: newCode,
              pin_code: pin,
              owner_id: user?.id || `guest_${Date.now()}`,
            })
            .select()
            .single()

          if (retryError) {
            console.error("Retry insert error:", retryError)
            toast.error(retryError.message || JSON.stringify(retryError))
            setLoading(false)
            return
          }
          toast.success(`Group created! Your group code is: ${newCode}`)
          router.push(`/groups/${retryGroup.id}`)
          router.refresh()
          setLoading(false)
          return
        }
        toast.error(groupError.message || JSON.stringify(groupError))
        setLoading(false)
        return
      }

      if (user) {
        const { error: memberError } = await supabase
          .from("group_members")
          .insert({
            group_id: group.id,
            user_id: user.id,
            display_name: user.email?.split("@")[0] || "You",
          })

        if (memberError) {
          console.error("Member insert error:", memberError)
          toast.error(memberError.message || JSON.stringify(memberError))
          setLoading(false)
          return
        }
      }

      toast.success(`Group created! Your group code is: ${group.group_code}`)
      router.push(`/groups/${group.id}`)
      router.refresh()
    } catch (error) {
      console.error("Create group error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create group")
    } finally {
      setLoading(false)
    }
  }

  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 pt-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" className="p-0 h-8 w-8" onClick={() => setStep("pin")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle>Confirm PIN</CardTitle>
            </div>
            <CardDescription>Re-enter your 4-digit PIN to confirm</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateGroup(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirmPin">Confirm 4-Digit PIN</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="Re-enter PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || confirmPin.length !== 4}>
                {loading ? "Creating..." : "Create Group"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === "pin") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 pt-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" className="p-0 h-8 w-8" onClick={() => setStep("details")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle>Set PIN</CardTitle>
            </div>
            <CardDescription>Create a 4-digit PIN for group security</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
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
                <p className="text-xs text-gray-500">This PIN will be required for members to join</p>
              </div>

              <Button type="submit" className="w-full" disabled={pin.length !== 4}>
                Continue
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
            <CardTitle>Create Group</CardTitle>
          </div>
          <CardDescription>Create a new expense group with a unique 6-character code</CardDescription>
        </CardHeader>
        <CardContent>
          {isGuest && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Not logged in</p>
                  <p className="text-xs mt-1">If you create this group without logging in, you may lose access if you close this browser. Consider logging in to keep your group safe.</p>
                </div>
              </div>
            </div>
          )}
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name</Label>
              <Input
                id="name"
                placeholder="e.g., Tokyo Trip 2024"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Main Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full">
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
            </div>

            {!showAdditionalCurrency1 ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowAdditionalCurrency1(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Currency
              </Button>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Additional Currency</Label>
                  <Select 
                    value={additionalCurrency1 || ""} 
                    onValueChange={(v) => { 
                      setAdditionalCurrency1(v)
                      setAdditionalCurrency2("") 
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCurrencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.symbol} {c.code} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!showAdditionalCurrency2 && additionalCurrency1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowAdditionalCurrency2(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Currency
                  </Button>
                ) : showAdditionalCurrency2 ? (
                  <div className="space-y-2">
                    <Label>Additional Currency 2</Label>
                    <Select 
                      value={additionalCurrency2 || ""} 
                      onValueChange={setAdditionalCurrency2}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCurrencies.filter(c => c.code !== additionalCurrency1).map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.symbol} {c.code} - {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </>
            )}

            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
