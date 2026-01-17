import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IconSidebar } from '../IconSidebar'

// Mock dependencies
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() })
}))

// Mock Supabase
const mockSignOut = vi.fn()
const mockGetUser = vi.fn().mockResolvedValue({ 
  data: { user: { email: 'test@example.com' } } 
})

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut
    }
  })
}))

// Mock FeedbackDialog since it has complex internal logic we don't want to test here
vi.mock('@/components/layout/FeedbackDialog', () => ({
  FeedbackDialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="feedback-dialog-trigger">{children}</div>
  )
}))

// Mock Dropdown Menu parts to ensure they render in test environment
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode, onClick: () => void }) => (
    <button onClick={onClick} data-testid="dropdown-item">{children}</button>
  ),
}))

describe('IconSidebar', () => {
  const defaultProps = {
    onOpenLibrary: vi.fn(),
    onNewChat: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and displays user initial', async () => {
    render(<IconSidebar {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('T')).toBeInTheDocument() // T for test@example.com
    })
    expect(mockGetUser).toHaveBeenCalled()
  })

  it('renders New Chat button and handles click', () => {
    render(<IconSidebar {...defaultProps} />)
    
    const newChatBtn = screen.getByTitle('New Chat')
    fireEvent.click(newChatBtn)
    
    expect(defaultProps.onNewChat).toHaveBeenCalled()
  })

  it('renders Feedback button', () => {
    render(<IconSidebar {...defaultProps} />)
    expect(screen.getByText('Feedback')).toBeInTheDocument()
  })

  it('handles logout flow', async () => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    })

    render(<IconSidebar {...defaultProps} />)
    
    // Wait for user load
    await waitFor(() => screen.getByText('T'))
    
    // Simulate opening dropdown (our mock renders content always visible for simplicity, or we click trigger)
    // In our mock, content is just rendered. We find the Logout item.
    const logoutBtn = screen.getByText('Logout')
    fireEvent.click(logoutBtn)
    
    expect(mockSignOut).toHaveBeenCalled()
    await waitFor(() => {
      expect(window.location.href).toBe('/login')
    })
  })
})
