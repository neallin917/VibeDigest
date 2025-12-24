import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const textVariants = cva("", {
  variants: {
    variant: {
      body: "text-base leading-6",
      bodySm: "text-sm leading-5",
      caption: "text-xs leading-4",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
    },
  },
  defaultVariants: {
    variant: "body",
    tone: "default",
    weight: "normal",
  },
})

export interface TextProps
  extends VariantProps<typeof textVariants> {
  as?: "p" | "span" | "div" | "label"
}

type TextAs = NonNullable<TextProps["as"]>

export type PolymorphicTextProps<TAs extends TextAs = "p"> =
  React.ComponentPropsWithoutRef<TAs> &
  VariantProps<typeof textVariants> & {
    as?: TAs
  }

export const Text = React.forwardRef(
  <TAs extends TextAs = "p">(
    { as, className, variant, tone, weight, ...props }: PolymorphicTextProps<TAs>,
    ref: React.ForwardedRef<React.ElementRef<TAs>>
  ) => {
    const Comp = (as ?? "p") as any
    return (
      <Comp
        ref={ref}
        className={cn(textVariants({ variant, tone, weight }), className)}
        {...props}
      />
    )
  }
)
Text.displayName = "Text"

const headingVariants = cva("tracking-tight", {
  variants: {
    variant: {
      display:
        "text-5xl leading-[1.05] md:text-7xl md:leading-[1.05] font-bold tracking-tighter",
      h1: "text-[30px] leading-9 font-bold",
      h2: "text-[22px] leading-7 font-bold",
      h3: "text-lg leading-6 font-semibold",
      pageTitle:
        "text-lg leading-6 font-bold md:text-[22px] md:leading-7 break-words",
      mediaTitle:
        "text-lg leading-6 font-bold md:text-xl md:leading-7 text-white line-clamp-2",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "h2",
    tone: "default",
  },
})

export interface HeadingProps
  extends VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3"
}

type HeadingAs = NonNullable<HeadingProps["as"]>

export type PolymorphicHeadingProps<TAs extends HeadingAs = "h2"> =
  React.ComponentPropsWithoutRef<TAs> &
  VariantProps<typeof headingVariants> & {
    as?: TAs
  }

export const Heading = React.forwardRef(
  <TAs extends HeadingAs = "h2">(
    { as, className, variant, tone, ...props }: PolymorphicHeadingProps<TAs>,
    ref: React.ForwardedRef<React.ElementRef<TAs>>
  ) => {
    const Comp = (as ?? "h2") as any
    return (
      <Comp
        ref={ref}
        className={cn(headingVariants({ variant, tone }), className)}
        {...props}
      />
    )
  }
)
Heading.displayName = "Heading"

export { textVariants, headingVariants }

