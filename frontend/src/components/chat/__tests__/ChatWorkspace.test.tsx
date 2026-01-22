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
  usePathname: vi.fn(),
}))

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
}))

// Mock child components to isolate the layout test
vi.mock('../TopHeader', () => ({
  TopHeader: () => <div data-testid="top-header">TopHeader</div>
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

// Mock I18n
vi.mock('@/components/i18n/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en'
  })
}))

describe('ChatWorkspace', () => {
  it('renders the 3-column layout structure', () => {
    const mockProps = {
      activeThreadId: null,
      activeTaskId: null,
      initialMessages: [],
      onNewChat: vi.fn(),
      onSelectThread: vi.fn(),
      onSelectTask: vi.fn(),
      onChatStarted: vi.fn(),
    }
    render(<ChatWorkspace {...mockProps} />)

    // Check for main layout containers
    expect(screen.getByTestId('top-header')).toBeInTheDocument()
    expect(screen.getByTestId('chat-container')).toBeInTheDocument()

    // The panel might be hidden initially if no task is selected, but the container exists in DOM
    // Check if main wrapper exists
    const main = screen.getByTestId('chat-container').closest('main')
    expect(main).toHaveClass('flex-1')
  })
})
