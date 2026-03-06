"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps, toast } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      duration={1500}
      closeButton
      icons={{
        success: <CircleCheckIcon className="size-5 text-green-500" />,
        info: <InfoIcon className="size-5 text-blue-500" />,
        warning: <TriangleAlertIcon className="size-5 text-yellow-500" />,
        error: <OctagonXIcon className="size-5 text-red-500" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "12px",
          "--toast-success-bg": "#ecfdf5",
          "--toast-success-foreground": "#047857",
          "--toast-success-border": "#a7f3d0",
          "--toast-success-icon": "#047857",
          "--toast-error-bg": "#fef2f2",
          "--toast-error-foreground": "#dc2626",
          "--toast-error-border": "#fecaca",
          "--toast-error-icon": "#dc2626",
          "--toast-warning-bg": "#fffbeb",
          "--toast-warning-foreground": "#d97706",
          "--toast-warning-border": "#fed7aa",
          "--toast-warning-icon": "#d97706",
          "--toast-info-bg": "#eff6ff",
          "--toast-info-foreground": "#2563eb",
          "--toast-info-border": "#bfdbfe",
          "--toast-info-icon": "#2563eb",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

// Helper to show toast with consistent duration
export const showToast = {
  success: (message: string) => toast.success(message, { duration: 1500 }),
  error: (message: string) => toast.error(message, { duration: 3000 }),
  info: (message: string) => toast.info(message, { duration: 1500 }),
  warning: (message: string) => toast.warning(message, { duration: 2000 }),
}

// For backward compatibility
export { toast }
export { Toaster }
