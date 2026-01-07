import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import { HeroSection } from "./HeroSection"

// Mock I18n
vi.mock("@/components/i18n/I18nProvider", () => ({
    useI18n: () => ({
        t: (key: string) => {
            if (key === "landing.smartSummarizationDesc") return "Analysis **with power**"
            return key
        }
    })
}))

// Mock TaskForm
vi.mock("@/components/dashboard/TaskForm", () => ({
    TaskForm: ({ simple }: any) => <div data-testid="task-form" data-simple={simple}>TaskForm</div>
}))

describe("HeroSection", () => {
    it("renders title strings", () => {
        render(<HeroSection />)
        expect(screen.getByText("landing.titlePrefix")).toBeInTheDocument()
        expect(screen.getByText("landing.titleEmphasis")).toBeInTheDocument()
    })

    it("renders parsed markdown in description", () => {
        render(<HeroSection />)
        // Should have "with power" in bold
        const bold = screen.getByText("with power")
        expect(bold.tagName).toBe("STRONG")
    })

    it("renders TaskForm in simple mode", () => {
        render(<HeroSection />)
        const form = screen.getByTestId("task-form")
        expect(form).toBeInTheDocument()
        expect(form).toHaveAttribute("data-simple", "true")
    })
})
