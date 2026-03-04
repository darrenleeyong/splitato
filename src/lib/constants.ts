export const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
] as const

export type CurrencyCode = typeof CURRENCIES[number]["code"]

export const EXPENSE_CATEGORIES = [
  { id: "general", name: "General", emoji: "📝" },
  { id: "food", name: "Food & Drinks", emoji: "🍔", keywords: ["food", "meal", "lunch", "dinner", "breakfast", "restaurant", "cafe", "coffee", "drink", "beer", "wine", "pizza", "burger", "sushi", "noodle", "rice"] },
  { id: "transport", name: "Transport", emoji: "🚕", keywords: ["taxi", "uber", "grab", "bus", "train", "metro", "subway", "transport", "transportation", "gas", "fuel", "parking", "toll", "car rental", "bike"] },
  { id: "accommodation", name: "Accommodation", emoji: "🏨", keywords: ["hotel", "hostel", "airbnb", "resort", "motel", "accommodation", "room", "stay", "lodging"] },
  { id: "entertainment", name: "Entertainment", emoji: "🎬", keywords: ["movie", "film", "cinema", "concert", "game", "gaming", "ticket", "show", "museum", "park", "attraction", "entertainment", "netflix", "spotify"] },
  { id: "shopping", name: "Shopping", emoji: "🛍️", keywords: ["shop", "shopping", "store", "mall", "market", "clothes", "clothing", "gift", "souvenir"] },
  { id: "utilities", name: "Utilities", emoji: "💡", keywords: ["bill", "utility", "utilities", "electric", "water", "internet", "wifi", "phone", "mobile", "data"] },
  { id: "health", name: "Health", emoji: "💊", keywords: ["doctor", "hospital", "pharmacy", "medicine", "health", "medical", "dentist", "vaccine", "test"] },
  { id: "travel", name: "Travel", emoji: "✈️", keywords: ["flight", "airline", "airport", "visa", "travel", "trip", "tour", "guide"] },
  { id: "other", name: "Other", emoji: "📦" },
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]["id"]

export const getCategoryEmoji = (description: string) => {
  const lowerDesc = description.toLowerCase()
  
  for (const category of EXPENSE_CATEGORIES) {
    if ("keywords" in category && category.keywords) {
      for (const keyword of category.keywords) {
        if (lowerDesc.includes(keyword)) {
          return category.emoji
        }
      }
    }
  }
  
  return "📝"
}

export const getCategoryName = (category: string) => {
  const found = EXPENSE_CATEGORIES.find(c => c.id === category)
  return found?.name || "General"
}

export const getCurrencySymbol = (code: string) => {
  const currency = CURRENCIES.find(c => c.code === code)
  return currency?.symbol || code
}
