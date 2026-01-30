/**
 * React hook for SSE (Server-Sent Events) task progress streaming.
 *
 * Provides real-time task updates without polling by maintaining
 * an EventSource connection to the backend SSE endpoint.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Type-safe event handling
 * - Connection state management
 * - Cleanup on unmount
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Event types matching backend schemas/events.py
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'error';
export type OutputKind =
  | 'script'
  | 'script_raw'
  | 'audio'
  | 'classification'
  | 'summary_source'
  | 'summary'
  | 'comprehension_brief';

export interface TaskProgressEvent {
  event_type: 'progress';
  task_id: string;
  status: TaskStatus;
  progress: number;
  stage: string;
  message?: string;
  timestamp: string;
}

export interface TaskOutputEvent {
  event_type: 'output';
  task_id: string;
  output_id: string;
  output_kind: OutputKind;
  status: TaskStatus;
  content?: string;
  locale?: string;
  timestamp: string;
}

export interface TaskCompleteEvent {
  event_type: 'complete';
  task_id: string;
  status: 'completed';
  video_title?: string;
  thumbnail_url?: string;
  duration?: number;
  timestamp: string;
}

export interface TaskErrorEvent {
  event_type: 'error';
  task_id: string;
  status: 'error';
  error: string;
  error_code?: string;
  recoverable: boolean;
  timestamp: string;
}

export interface HeartbeatEvent {
  event_type: 'heartbeat';
  timestamp: string;
}

export type SSEEvent =
  | TaskProgressEvent
  | TaskOutputEvent
  | TaskCompleteEvent
  | TaskErrorEvent
  | HeartbeatEvent;

export interface UseTaskStreamOptions {
  /** Callback when progress updates are received */
  onProgress?: (event: TaskProgressEvent) => void;
  /** Callback when an output is ready */
  onOutput?: (event: TaskOutputEvent) => void;
  /** Callback when task completes successfully */
  onComplete?: (event: TaskCompleteEvent) => void;
  /** Callback when task encounters an error */
  onError?: (event: TaskErrorEvent) => void;
  /** Callback for any event (useful for logging) */
  onEvent?: (event: SSEEvent) => void;
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Base URL for API (default: '') */
  baseUrl?: string;
}

export interface UseTaskStreamReturn {
  /** Whether the SSE connection is currently open */
  isConnected: boolean;
  /** The last received event */
  lastEvent: SSEEvent | null;
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current processing stage */
  stage: string;
  /** Latest status message */
  message: string;
  /** Current task status */
  status: TaskStatus;
  /** Connection error if any */
  error: string | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Manually disconnect the stream */
  disconnect: () => void;
  /** Manually reconnect the stream */
  reconnect: () => void;
}

/**
 * Hook for streaming task progress updates via SSE.
 *
 * @param taskId - The task ID to stream updates for (null to disable)
 * @param options - Configuration options
 * @returns Stream state and control functions
 *
 * @example
 * ```tsx
 * const { progress, status, isConnected } = useTaskStream(taskId, {
 *   onProgress: (e) => console.log(`Progress: ${e.progress}%`),
 *   onComplete: (e) => console.log('Task completed!'),
 *   onError: (e) => console.error(e.error),
 * });
 * ```
 */
export function useTaskStream(
  taskId: string | null,
  options: UseTaskStreamOptions = {}
): UseTaskStreamReturn {
  const {
    onProgress,
    onOutput,
    onComplete,
    onError,
    onEvent,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    baseUrl = '',
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTerminalRef = useRef(false);

  // Store callbacks in refs to avoid reconnection on callback changes
  const callbacksRef = useRef({
    onProgress,
    onOutput,
    onComplete,
    onError,
    onEvent,
  });
  callbacksRef.current = {
    onProgress,
    onOutput,
    onComplete,
    onError,
    onEvent,
  };

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!taskId) return;

    // Don't reconnect if we've reached a terminal state
    if (isTerminalRef.current) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${baseUrl}/api/tasks/${taskId}/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      setReconnectAttempts(0);
    };

    // Generic message handler for events without type
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SSEEvent;
        setLastEvent(data);
        callbacksRef.current.onEvent?.(data);
      } catch {
        console.warn('Failed to parse SSE message:', e.data);
      }
    };

    // Handler for 'init' events
    eventSource.addEventListener('init', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as TaskProgressEvent;
        setLastEvent(data);
        setProgress(data.progress);
        setStage(data.stage);
        setStatus(data.status);
        if (data.message) setMessage(data.message);
        callbacksRef.current.onEvent?.(data);
      } catch {
        console.warn('Failed to parse init event:', e.data);
      }
    });

    // Handler for 'progress' events
    eventSource.addEventListener('progress', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as TaskProgressEvent;
        setLastEvent(data);
        setProgress(data.progress);
        setStage(data.stage);
        setStatus(data.status);
        if (data.message) setMessage(data.message);
        callbacksRef.current.onProgress?.(data);
        callbacksRef.current.onEvent?.(data);
      } catch {
        console.warn('Failed to parse progress event:', e.data);
      }
    });

    // Handler for 'output' events
    eventSource.addEventListener('output', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as TaskOutputEvent;
        setLastEvent(data);
        callbacksRef.current.onOutput?.(data);
        callbacksRef.current.onEvent?.(data);
      } catch {
        console.warn('Failed to parse output event:', e.data);
      }
    });

    // Handler for 'complete' events
    eventSource.addEventListener('complete', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as TaskCompleteEvent;
        setLastEvent(data);
        setProgress(100);
        setStatus('completed');
        setMessage('Task completed');
        isTerminalRef.current = true;
        callbacksRef.current.onComplete?.(data);
        callbacksRef.current.onEvent?.(data);
        // Close connection after completion
        eventSource.close();
        setIsConnected(false);
      } catch {
        console.warn('Failed to parse complete event:', e.data);
      }
    });

    // Handler for 'error' events (from server)
    eventSource.addEventListener('error', (e: MessageEvent) => {
      // Check if this is a server-sent error event (has data) or connection error
      if (e.data) {
        try {
          const data = JSON.parse(e.data) as TaskErrorEvent;
          setLastEvent(data);
          setStatus('error');
          setError(data.error);
          setMessage(data.error);
          isTerminalRef.current = !data.recoverable;
          callbacksRef.current.onError?.(data);
          callbacksRef.current.onEvent?.(data);
          if (!data.recoverable) {
            eventSource.close();
            setIsConnected(false);
          }
        } catch {
          console.warn('Failed to parse error event:', e.data);
        }
      }
    });

    // Handler for 'heartbeat' events
    eventSource.addEventListener('heartbeat', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as HeartbeatEvent;
        callbacksRef.current.onEvent?.(data);
      } catch {
        // Heartbeat parsing failure is not critical
      }
    });

    // Connection error handler (network issues)
    eventSource.onerror = () => {
      setIsConnected(false);

      // Don't reconnect if terminal state reached
      if (isTerminalRef.current) return;

      // Attempt reconnection with exponential backoff
      if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        setReconnectAttempts((prev) => prev + 1);
        setError(`Connection lost. Reconnecting in ${delay / 1000}s...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        setError('Connection failed after multiple attempts. Please refresh.');
      }
    };
  }, [taskId, baseUrl, autoReconnect, maxReconnectAttempts, reconnectAttempts]);

  const reconnect = useCallback(() => {
    isTerminalRef.current = false;
    setReconnectAttempts(0);
    setError(null);
    connect();
  }, [connect]);

  // Connect when taskId changes
  useEffect(() => {
    if (taskId) {
      // Reset state for new task
      isTerminalRef.current = false;
      setProgress(0);
      setStage('');
      setMessage('');
      setStatus('pending');
      setError(null);
      setReconnectAttempts(0);
      connect();
    }

    return () => {
      disconnect();
    };
  }, [taskId, connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    progress,
    stage,
    message,
    status,
    error,
    reconnectAttempts,
    disconnect,
    reconnect,
  };
}

export default useTaskStream;
