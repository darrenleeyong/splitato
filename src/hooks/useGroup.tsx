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
  setPinVerified: (groupId: string) => void
  isPinVerified: (groupId: string) => boolean
  clearPinVerification: (groupId: string) => void
}

const STORAGE_KEY = "splitato_verified_pins"

const getStoredVerifiedPins = (): Record<string, boolean> => {
  if (typeof window === "undefined") return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

const storeVerifiedPins = (pins: Record<string, boolean>) => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
  } catch {
    // Storage full or unavailable
  }
}

const GroupContext = createContext<GroupContextType | undefined>(undefined)

export function GroupProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [verifiedPins, setVerifiedPins] = useState<Record<string, boolean>>(() => getStoredVerifiedPins())
  const supabase = createClient()

  const fetchGroups = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setGroups([])
      setLoading(false)
      return
    }

    console.log("Fetching groups for user:", user.id)

    // Fetch groups where user is a member
    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id)

    if (membersError) {
      console.error("Error fetching group members:", membersError)
      setGroups([])
      setLoading(false)
      return
    }

    // Also fetch groups where user is the owner
    const { data: ownedGroups, error: ownedError } = await supabase
      .from("groups")
      .select("*")
      .eq("owner_id", user.id)

    if (ownedError) {
      console.error("Error fetching owned groups:", ownedError)
    }

    if ((!members || members.length === 0) && (!ownedGroups || ownedGroups.length === 0)) {
      console.log("No groups found for user")
      setGroups([])
      setLoading(false)
      return
    }

    // Combine group IDs from both queries
    const memberGroupIds = members?.map((m: GroupMember) => m.group_id) || []
    const ownedGroupIds = ownedGroups?.map((g: Group) => g.id) || []
    const allGroupIds = [...new Set([...memberGroupIds, ...ownedGroupIds])]
    console.log("All Group IDs:", allGroupIds)

    // If we already have owned groups, we can use them directly
    let groupsData = ownedGroups || []

    // If user is a member of additional groups, fetch those too
    if (memberGroupIds.length > 0) {
      const { data: memberGroups, error: memberGroupsError } = await supabase
        .from("groups")
        .select("*")
        .in("id", memberGroupIds)

      if (memberGroupsError) {
        console.error("Error fetching member groups:", memberGroupsError)
      } else if (memberGroups) {
        // Merge and deduplicate
        const allGroups = [...groupsData, ...memberGroups]
        const uniqueGroups = allGroups.filter((group, index, self) => 
          index === self.findIndex(g => g.id === group.id)
        )
        groupsData = uniqueGroups
      }
    }

    console.log("Groups fetched:", groupsData)
    setGroups(groupsData || [])
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
      setVerifiedPins(prev => {
        const newState = { ...prev, [groupId]: true }
        storeVerifiedPins(newState)
        return newState
      })
    }
    return isValid
  }

  const isPinVerified = (groupId: string): boolean => {
    return verifiedPins[groupId] || false
  }

  const setPinVerified = (groupId: string) => {
    setVerifiedPins(prev => {
      const newState = { ...prev, [groupId]: true }
      storeVerifiedPins(newState)
      return newState
    })
  }

  const clearPinVerification = (groupId: string) => {
    setVerifiedPins(prev => {
      const newState = { ...prev }
      delete newState[groupId]
      storeVerifiedPins(newState)
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
      setPinVerified,
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
