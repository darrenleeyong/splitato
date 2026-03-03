"use client"

import { useState, useEffect, createContext, useContext, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Group, GroupMember } from "@/lib/supabase/types"

interface GroupContextType {
  groups: Group[]
  loading: boolean
  fetchGroups: () => Promise<void>
  getGroup: (groupId: string) => Promise<Group | null>
  getGroupMembers: (groupId: string) => Promise<GroupMember[]>
  verifyPin: (groupId: string, pin: string) => Promise<boolean>
  isPinVerified: (groupId: string) => boolean
  clearPinVerification: (groupId: string) => void
}

const GroupContext = createContext<GroupContextType | undefined>(undefined)

export function GroupProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [verifiedPins, setVerifiedPins] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  const fetchGroups = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setGroups([])
      setLoading(false)
      return
    }

    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id)

    if (membersError || !members) {
      setGroups([])
      setLoading(false)
      return
    }

    const groupIds = members.map(m => m.group_id)
    const { data: groupsData, error: groupsError } = await supabase
      .from("groups")
      .select("*")
      .in("id", groupIds)

    if (groupsError) {
      setGroups([])
    } else {
      setGroups(groupsData || [])
    }
    setLoading(false)
  }

  const getGroup = async (groupId: string): Promise<Group | null> => {
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single()

    return error ? null : data
  }

  const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
    const { data, error } = await supabase
      .from("group_members")
      .select("*")
      .eq("group_id", groupId)

    return error ? [] : data || []
  }

  const verifyPin = async (groupId: string, pin: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("groups")
      .select("pin_code")
      .eq("id", groupId)
      .single()

    if (error || !data) return false

    const isValid = data.pin_code === pin
    if (isValid) {
      setVerifiedPins(prev => ({ ...prev, [groupId]: true }))
    }
    return isValid
  }

  const isPinVerified = (groupId: string): boolean => {
    return verifiedPins[groupId] || false
  }

  const clearPinVerification = (groupId: string) => {
    setVerifiedPins(prev => {
      const newState = { ...prev }
      delete newState[groupId]
      return newState
    })
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  return (
    <GroupContext.Provider value={{
      groups,
      loading,
      fetchGroups,
      getGroup,
      getGroupMembers,
      verifyPin,
      isPinVerified,
      clearPinVerification
    }}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() {
  const context = useContext(GroupContext)
  if (context === undefined) {
    throw new Error("useGroup must be used within a GroupProvider")
  }
  return context
}
