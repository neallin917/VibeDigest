import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatWorkspace } from '../ChatWorkspace'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
}))

// Mock child components to isolate the layout test
vi.mock('../IconSidebar', () => ({
  IconSidebar: () => <div data-testid="icon-sidebar">IconSidebar</div>
}))

vi.mock('../ChatContainer', () => ({
  ChatContainer: () => <div data-testid="chat-container">ChatContainer</div>
}))

vi.mock('../VideoDetailPanel', () => ({
  VideoDetailPanel: () => <div data-testid="video-panel">VideoDetailPanel</div>
}))

vi.mock('../LibrarySidebar', () => ({
  LibrarySidebar: () => <div data-testid="library-sidebar">LibrarySidebar</div>
}))

describe('ChatWorkspace', () => {
  it('renders the 3-column layout structure', () => {
    render(<ChatWorkspace />)
    
    // Check for main layout containers
    expect(screen.getByTestId('icon-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('chat-container')).toBeInTheDocument()
    
    // The panel might be hidden initially if no task is selected, but the container exists in DOM
    // Check if main wrapper exists
    const main = screen.getByTestId('chat-container').closest('main')
    expect(main).toHaveClass('flex-1')
  })
})
