import { create } from 'zustand'

export interface ChatMember {
  id: string
  nickname: string
  displayName: string
  avatarColor: string
}

export interface Chat {
  id: string
  type: 'direct' | 'group'
  name: string | null
  members: ChatMember[]
  lastMessage?: string
  lastMessageAt?: string
  lastMessageBy?: string
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  senderName?: string
  senderNickname?: string
  senderColor?: string
  type: 'text' | 'quiz_start' | 'quiz_result' | 'system'
  content: string
  metadata?: any
  createdAt: string
}

interface ChatState {
  chats: Chat[]
  messages: Record<string, Message[]>
  activeChatId: string | null
  setChats: (chats: Chat[]) => void
  addChat: (chat: Chat) => void
  setMessages: (chatId: string, msgs: Message[]) => void
  addMessage: (msg: Message) => void
  setActiveChatId: (id: string | null) => void
  updateChatLastMessage: (chatId: string, content: string, at: string, by: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  messages: {},
  activeChatId: null,
  setChats: (chats) => set({ chats }),
  addChat: (chat) => set((s) => ({ chats: [chat, ...s.chats.filter(c => c.id !== chat.id)] })),
  setMessages: (chatId, msgs) => set((s) => ({ messages: { ...s.messages, [chatId]: msgs } })),
  addMessage: (msg) => set((s) => {
    const existing = s.messages[msg.chatId] || []
    if (existing.find(m => m.id === msg.id)) return s
    return { messages: { ...s.messages, [msg.chatId]: [...existing, msg] } }
  }),
  setActiveChatId: (id) => set({ activeChatId: id }),
  updateChatLastMessage: (chatId, content, at, by) => set((s) => ({
    chats: s.chats.map(c => c.id === chatId ? { ...c, lastMessage: content, lastMessageAt: at, lastMessageBy: by } : c)
      .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))
  }))
}))
