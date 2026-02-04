import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ChatWorkspace } from '../ChatWorkspace'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn()
  })
}))

vi.mock('../TopHeader', () => ({
  TopHeader: ({ onMobileMenuClick }: any) => (
    <div data-testid="top-header">
      <button onClick={onMobileMenuClick}>Menu</button>
    </div>
  )
}))

vi.mock('../ChatContainer', () => ({
  ChatContainer: () => <div data-testid="chat-container">ChatContainer</div>
}))

vi.mock('../VideoDetailPanel', () => ({
  VideoDetailPanel: ({ onClose }: any) => (
    <div data-testid="video-panel">
      VideoDetailPanel
      <button onClick={onClose}>Close</button>
    </div>
  )
}))

vi.mock('../MobileMenuDrawer', () => ({
  MobileMenuDrawer: ({ isOpen, onOpenChange }: any) => (
    <div data-testid="mobile-menu" data-open={isOpen}>
      <button onClick={() => onOpenChange(false)}>Close Menu</button>
    </div>
  )
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, children }: any) => open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetTitle: () => <div>Title</div>
}))

vi.mock('@/components/i18n/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en'
  })
}))

const localStorageMock = (function() {
  let store: any = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString() }),
    clear: vi.fn(() => { store = {} })
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('ChatWorkspace', () => {
  const defaultProps = {
    activeThreadId: null,
    activeTaskId: null,
    initialMessages: [],
    onNewChat: vi.fn(),
    onSelectThread: vi.fn(),
    onSelectTask: vi.fn(),
    onChatStarted: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 })
    window.dispatchEvent(new Event('resize'))
  })

  it('renders desktop layout correctly', () => {
    render(<ChatWorkspace {...defaultProps} />)
    expect(screen.getByTestId('top-header')).toBeInTheDocument()
    expect(screen.getByTestId('chat-container')).toBeInTheDocument()
    expect(screen.queryByTestId('video-panel')).not.toBeInTheDocument()
  })

  it('renders video panel when task is selected (desktop)', async () => {
    render(<ChatWorkspace {...defaultProps} activeTaskId="task-1" />)
    expect(await screen.findByTestId('video-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument()
  })

  it('renders sheet on mobile when task is selected', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 })
    window.dispatchEvent(new Event('resize'))

    render(<ChatWorkspace {...defaultProps} activeTaskId="task-1" />)
    expect(await screen.findByTestId('sheet')).toBeInTheDocument()
    // Both panels exist in DOM, but desktop is hidden via CSS class
    expect(screen.getAllByTestId('video-panel')).toHaveLength(2)
  })

  it('handles panel closing', async () => {
    render(<ChatWorkspace {...defaultProps} activeTaskId="task-1" />)
    
    // There might be multiple Close buttons (desktop + mobile)
    const closeBtns = await screen.findAllByText('Close')
    fireEvent.click(closeBtns[0])
    
    expect(defaultProps.onSelectTask).toHaveBeenCalledWith(null)
  })

  it('opens mobile menu', () => {
    render(<ChatWorkspace {...defaultProps} />)
    
    const menuBtn = screen.getByText('Menu')
    fireEvent.click(menuBtn)
    
    const menu = screen.getByTestId('mobile-menu')
    expect(menu).toHaveAttribute('data-open', 'true')
  })

  it('handles resizing', () => {
    render(<ChatWorkspace {...defaultProps} activeTaskId="task-1" />)
    
    const resizer = document.querySelector('.cursor-col-resize') as Element
    expect(resizer).toBeInTheDocument()

    fireEvent.mouseDown(resizer)

    act(() => {
        const moveEvent = new MouseEvent('mousemove', { clientX: 600 })
        window.dispatchEvent(moveEvent)
    })

    act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'))
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith('vibe_panel_width', expect.any(String))
  })
})
