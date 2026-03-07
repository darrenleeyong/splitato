import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers"
import { Header } from "@/components/header"
import { ThemeProvider } from "@/components/theme-provider"

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: {
    default: "Splitato - Split Group Trip Expenses Easily",
    template: "%s | Splitato",
  },
  description: "Track and split expenses with your travel group effortlessly. Splitato helps friends and travel companions manage shared costs, track who owes whom, and settle up easily.",
  keywords: ["expense splitter", "group trip", "travel expenses", "bill splitting", "shared costs", "trip calculator", "owe money", "split bills"],
  authors: [{ name: "Splitato" }],
  creator: "Splitato",
  publisher: "Splitato",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://splitato.com",
    siteName: "Splitato",
    title: "Splitato - Split Group Trip Expenses Easily",
    description: "Track and split expenses with your travel group effortlessly. Splitato helps friends and travel companions manage shared costs.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Splitato - Group Trip Expense Splitter",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Splitato - Split Group Trip Expenses Easily",
    description: "Track and split expenses with your travel group effortlessly.",
    images: ["/og-image.png"],
    creator: "@splitato",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} antialiased`}>
        <ThemeProvider
          defaultTheme="dark"
          enableSystem
          attribute="class"
          disableTransitionOnChange
        >
          <Providers>
            <Header />
            {children}
            <Toaster />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
