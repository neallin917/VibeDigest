import { CreditCard, History, PlusCircle, Settings } from "lucide-react"

export const NAV_ITEMS = [
  { key: "nav.newTask", href: "/dashboard", icon: PlusCircle },
  { key: "nav.history", href: "/history", icon: History },
  { key: "nav.settings", href: "/settings", icon: Settings },
  { key: "nav.pricing", href: "/settings/pricing", icon: CreditCard },
] as const


