import { render, screen, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { LandingNav } from "./LandingNav"

// Mocks
const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: vi.fn(),
}))
import { usePathname } from "next/navigation"

vi.mock("@/components/i18n/I18nProvider", () => ({
    useI18n: () => ({ locale: "en", t: (k: string) => k })
}))

vi.mock("@/components/auth/LandingUserButton", () => ({
    LandingUserButton: () => <button>UserButton</button>
}))
vi.mock("@/components/i18n/LanguageInlineSelect", () => ({
    LanguageInlineSelect: () => <button>LangSelect</button>
}))
vi.mock("@/components/layout/BrandLogo", () => ({
    BrandLogo: () => <span>Logo</span>
}))
vi.mock("@/components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: any) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
    DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
}))

describe("LandingNav", () => {
    beforeEach(() => {
        vi.clearAllMocks()
            ; (usePathname as any).mockReturnValue("/en")
    })

    it("renders core elements", () => {
        render(<LandingNav />)
        expect(screen.getByText("Logo")).toBeInTheDocument()
        expect(screen.getAllByText("Demos").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Features").length).toBeGreaterThan(0)
        expect(screen.getAllByText("UserButton")[0]).toBeInTheDocument()
    })

    it("scrolls to hero when logo is clicked", () => {
        render(<LandingNav />)
        const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => { })

        // Mock Hero element
        const heroEl = document.createElement("div")
        heroEl.id = "hero"
        document.body.appendChild(heroEl)
        vi.spyOn(document, "getElementById").mockReturnValue(heroEl)

        const logo = screen.getByText("Logo")
        fireEvent.click(logo)

        expect(scrollToSpy).toHaveBeenCalled()

        scrollToSpy.mockRestore()
        heroEl.remove()
    })

    it("navigates to anchor if on landing page", () => {
        render(<LandingNav />)
        const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => { })
        // Mock element
        const mockEl = document.createElement("div")
        mockEl.id = "demos"
        document.body.appendChild(mockEl)
        vi.spyOn(mockEl, "getBoundingClientRect").mockReturnValue({ top: 500 } as any)
        vi.spyOn(document, "getElementById").mockReturnValue(mockEl)

        const demoBtn = screen.getAllByText("Demos")[0] // Desktop
        fireEvent.click(demoBtn)

        expect(scrollToSpy).toHaveBeenCalled()

        scrollToSpy.mockRestore()
        mockEl.remove()
    })

    it("navigates to router path if not on landing page", () => {
        ; (usePathname as any).mockReturnValue("/en/faq") // Different page
        render(<LandingNav />)
        const demoBtn = screen.getAllByText("Demos")[0]
        fireEvent.click(demoBtn)

        expect(mockPush).toHaveBeenCalledWith("/en#demos")
    })

    it("handles scroll spy update", () => {
        render(<LandingNav />)
        // Functional verification only - ensuring no crash on scroll
        fireEvent.scroll(window, { target: { scrollY: 100 } })
    })
})
