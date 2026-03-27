import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useAuthStore } from '../stores/authStore'
import { useChatStore, Message } from '../stores/chatStore'
import { getSocket } from '../socket'
import QuizBattleUI from '../components/QuizBattleUI'

interface Props {
  chatId: string
  onBack: () => void
}

export default function ChatRoom({ chatId, onBack }: Props) {
  const user = useAuthStore(s => s.user)
  const chats = useChatStore(s => s.chats)
  const messages = useChatStore(s => s.messages[chatId] || [])
  const setMessages = useChatStore(s => s.setMessages)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState<string | null>(null)
  const [showQuizBattle, setShowQuizBattle] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<any>(null)

  const chat = chats.find(c => c.id === chatId)
  const otherMember = chat?.members.find(m => m.id !== user?.id)

  const chatTitle = chat?.type === 'group'
    ? (chat.name || 'Группа')
    : (otherMember?.displayName || 'Чат')

  const chatSubtitle = chat?.type === 'group'
    ? `${chat.members.length} участник${chat.members.length > 4 ? 'ов' : chat.members.length > 1 ? 'а' : ''}`
    : `@${otherMember?.nickname || ''}`

  useEffect(() => {
    loadMessages()
    const socket = getSocket()
    socket?.emit('chat:join', { chatId })

    const handleTyping = (data: any) => {
      if (data.chatId === chatId && data.odId !== user?.id) {
        if (data.isTyping) {
          setTyping(data.displayName)
          setTimeout(() => setTyping(null), 3000)
        } else {
          setTyping(null)
        }
      }
    }

    socket?.on('typing:update', handleTyping)
    return () => { socket?.off('typing:update', handleTyping) }
  }, [chatId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadMessages = async () => {
    try {
      const data = await api.getMessages(chatId)
      setMessages(chatId, data)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  const sendMessage = () => {
    const text = input.trim()
    if (!text) return
    const socket = getSocket()
    socket?.emit('message:send', { chatId, content: text })
    socket?.emit('typing:stop', { chatId })
    setInput('')
  }

  const handleInputChange = (val: string) => {
    setInput(val)
    const socket = getSocket()
    socket?.emit('typing:start', { chatId })
    clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socket?.emit('typing:stop', { chatId })
    }, 2000)
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  }

  const renderMessage = (msg: Message, idx: number) => {
    const isMine = msg.senderId === user?.id
    const isSystem = msg.type === 'system' || msg.type === 'quiz_start' || msg.type === 'quiz_result'

    if (isSystem) {
      return (
        <div key={msg.id} className="bubble-system" style={{ animation: `fadeIn 0.2s ease-out ${Math.min(idx * 0.03, 0.3)}s both` }}>
          {msg.content}
        </div>
      )
    }

    // Show sender name in groups
    const showName = chat?.type === 'group' && !isMine
    const prevMsg = messages[idx - 1]
    const sameSender = prevMsg && prevMsg.senderId === msg.senderId && prevMsg.type !== 'system'

    return (
      <div key={msg.id} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        marginTop: sameSender ? 2 : 8,
        animation: `fadeIn 0.2s ease-out`
      }}>
        {showName && !sameSender && (
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: msg.senderColor || 'var(--accent)',
            marginBottom: 2,
            marginLeft: 4
          }}>
            {msg.senderName}
          </span>
        )}
        <div className={`bubble ${isMine ? 'bubble-mine' : 'bubble-other'}`}>
          {msg.content}
        </div>
        <span style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: 2,
          marginLeft: 4,
          marginRight: 4
        }}>
          {formatTime(msg.createdAt)}
        </span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }} className="animate-slideIn">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 24,
            cursor: 'pointer',
            padding: '4px 8px',
            marginLeft: -8
          }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>{chatTitle}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {typing ? `${typing} печатает...` : chatSubtitle}
          </p>
        </div>
        {/* Quiz battle button */}
        <button
          onClick={() => setShowQuizBattle(true)}
          style={{
            width: 40, height: 40,
            borderRadius: 12,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Начать викторину"
        >
          🎯
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {messages.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)'
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>👋</div>
            <p style={{ fontSize: 14 }}>Начните общение!</p>
          </div>
        )}
        {messages.map((msg, i) => renderMessage(msg, i))}
      </div>

      {/* Quiz Battle overlay */}
      {showQuizBattle && (
        <QuizBattleUI chatId={chatId} onClose={() => setShowQuizBattle(false)} />
      )}

      {/* Input */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)'
      }}>
        <input
          className="input"
          placeholder="Сообщение..."
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          style={{ flex: 1, borderRadius: 20, padding: '12px 18px' }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          style={{
            width: 48, height: 48,
            borderRadius: '50%',
            background: input.trim() ? 'var(--accent)' : 'var(--bg-card)',
            border: 'none',
            color: 'white',
            fontSize: 20,
            cursor: input.trim() ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'background 0.2s'
          }}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
