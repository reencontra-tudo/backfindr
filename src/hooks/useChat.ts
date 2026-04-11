import { useEffect, useRef, useState, useCallback } from 'react';
import Cookies from 'js-cookie';

export interface ChatMsg {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  is_system: boolean;
}

export interface TypingUser {
  user_id: string;
  user_name: string;
}

interface UseChatReturn {
  messages: ChatMsg[];
  typingUsers: TypingUser[];
  connected: boolean;
  send: (content: string) => void;
  sendTyping: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') ?? 'ws://localhost:8000';
const RECONNECT_DELAY = 3000;
const TYPING_TIMEOUT = 2500;

export function useChat(matchId: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const connect = useCallback(() => {
    const token = Cookies.get('access_token');
    if (!token || !matchId) return;

    const ws = new WebSocket(`${WS_URL}/api/v1/chat/ws/${matchId}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'history':
          setMessages(data.messages ?? []);
          break;

        case 'message':
          setMessages((prev) => {
            if (prev.find((m) => m.id === data.id)) return prev;
            return [...prev, data as ChatMsg];
          });
          // Clear typing for this sender
          setTypingUsers((prev) => prev.filter((u) => u.user_id !== data.sender_id));
          break;

        case 'typing':
          setTypingUsers((prev) => {
            if (prev.find((u) => u.user_id === data.user_id)) return prev;
            return [...prev, { user_id: data.user_id, user_name: data.user_name }];
          });
          // Auto-clear after timeout
          clearTimeout(typingTimers.current[data.user_id]);
          typingTimers.current[data.user_id] = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.user_id !== data.user_id));
          }, TYPING_TIMEOUT);
          break;

        case 'presence':
          // Could show online status — reserved for future
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect
      reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => ws.close();
  }, [matchId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current!);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content }));
    }
  }, []);

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing' }));
    }
  }, []);

  return { messages, typingUsers, connected, send, sendTyping };
}
