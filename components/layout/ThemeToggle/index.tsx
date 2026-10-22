'use client'

import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      {/* Icons swap via the dark: variant, so server and client render identical markup */}
      <DropdownMenuTrigger
        className="cursor-pointer flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Change theme"
      >
        <Sun className="h-4 w-4 dark:hidden" />
        <Moon className="hidden h-4 w-4 dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup value={theme} onValueChange={value => setTheme(String(value))}>
          <DropdownMenuRadioItem value="light" className="cursor-pointer"><Sun />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="cursor-pointer"><Moon />Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="cursor-pointer"><Monitor />System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
