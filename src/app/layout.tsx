import type { Metadata } from "next"
import { Archivo, Lekton } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers"
import { Header } from "@/components/header"
import { ThemeProvider } from "@/components/theme-provider"

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
})

const lekton = Lekton({
  variable: "--font-lekton",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://splitato.com"),
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
      <body className={`${archivo.variable} ${lekton.variable} antialiased`}>
        <ThemeProvider
          defaultTheme="dark"
          enableSystem
          attribute="class"
          disableTransitionOnChange
        >
          <Providers>
            <Header />
            {children}
            <footer className="w-full py-6 px-4 text-center border-t border-gray-200 dark:border-gray-800">
              <div className="max-w-4xl mx-auto">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {"Made by "}
                  <a 
                    href="http://darrenleeyong.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary underline underline-offset-2"
                  >
                    Darren Lee
                  </a>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Last updated: Mar 2026
                </p>
              </div>
            </footer>
            <Toaster />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
