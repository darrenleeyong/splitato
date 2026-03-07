"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { getInitials, getAvatarColor } from "@/lib/utils"
import { Loader2Icon, UploadIcon, KeyIcon } from "lucide-react"

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)
  const [checkingPassword, setCheckingPassword] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, user, router])

  useEffect(() => {
    const checkPasswordStatus = async () => {
      if (!user) return

      const { data } = await supabase.auth.getUser()
      setHasPassword(!!data.user?.identities && data.user.identities.length > 0 && !!data.user.identities[0].provider)
      setCheckingPassword(false)
      setAvatarUrl(data.user?.user_metadata?.avatar_url || null)
    }

    if (user) {
      checkPasswordStatus()
    }
  }, [user, supabase])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploadingAvatar(true)

    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      toast.error("Failed to upload image")
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath)

    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    })

    if (updateError) {
      toast.error("Failed to update profile picture")
    } else {
      setAvatarUrl(publicUrl)
      toast.success("Profile picture updated")
    }

    setUploadingAvatar(false)
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Password set successfully")
      setNewPassword("")
      setConfirmPassword("")
      setHasPassword(true)
    }
    setLoading(false)
  }

  if (authLoading || checkingPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 pt-16">
        <Loader2Icon className="size-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const userInitials = getInitials(user.email)
  const avatarColor = getAvatarColor(user.email || "")

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 pt-16">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Profile Settings</CardTitle>
            <CardDescription className="dark:text-gray-400">
              Manage your account settings and profile picture
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="size-24">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className={`text-2xl ${avatarColor}`}>
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Loader2Icon className="size-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  <UploadIcon className="size-4 mr-2" />
                  {avatarUrl ? "Change Photo" : "Upload Photo"}
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  JPG, PNG or GIF. Max 2MB.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900 dark:text-white">Email</Label>
              <Input
                value={user.email || ""}
                disabled
                className="bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <KeyIcon className="size-5" />
              {hasPassword ? "Change Password" : "Set Password"}
            </CardTitle>
            <CardDescription className="dark:text-gray-400">
              {hasPassword
                ? "Update your account password"
                : "Set a password to sign in with email and password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-gray-900 dark:text-white">
                  {hasPassword ? "New Password" : "Password"}
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder={hasPassword ? "Enter new password" : "Create a password"}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-gray-900 dark:text-white">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Confirm your password"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-400"
                />
              </div>
              <Button
                type="submit"
                className="bg-[#1A1A1A] hover:bg-[#2D2D2D] dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                disabled={loading}
              >
                {loading && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                {hasPassword ? "Update Password" : "Set Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
