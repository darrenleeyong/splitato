"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, Users, Wallet, ArrowRight, Receipt, TrendingDown } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Split Expenses Easily
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Track and split expenses with your travel group. No more confusion about who owes whom.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
            <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white dark:text-gray-900">1</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Create or Join a Group</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Start a new trip group or join an existing one with a group code</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
            <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0">
              <Receipt className="h-4 w-4 text-white dark:text-gray-900" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Add Expenses</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Record what you paid for and split it evenly or custom</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
            <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0">
              <TrendingDown className="h-4 w-4 text-white dark:text-gray-900" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Settle Up</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">See who owes whom and record payments to settle up</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 pt-2">
          <Link href="/groups/create" className="block">
            <Button 
              className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white font-medium text-base dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Group
            </Button>
          </Link>
          
          <Link href="/groups/join" className="block">
            <Button 
              className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white font-medium text-base dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              size="lg"
            >
              <Users className="mr-2 h-5 w-5" />
              Join Group
            </Button>
          </Link>
          
          <Link href="/groups" className="block">
            <Button 
              className="w-full h-14 border-2 border-gray-900 text-gray-900 hover:bg-gray-50 font-medium text-base dark:border-white dark:text-white dark:hover:bg-gray-800"
              variant="outline"
              size="lg"
            >
              <Wallet className="mr-2 h-5 w-5" />
              My Groups
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
