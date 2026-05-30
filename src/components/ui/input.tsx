import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm font-medium transition-all outline-none",
        "placeholder:text-muted-foreground/50 placeholder:font-normal",
        "hover:border-primary/40 hover:bg-background",
        "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:bg-background",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15",
        "dark:bg-input/20 dark:hover:bg-input/40 dark:focus-visible:bg-input/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
