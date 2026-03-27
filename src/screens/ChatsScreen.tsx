import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuthStore } from '../stores/authStore'
import { useChatStore, Chat } from '../stores/chatStore'

interface Props {
  onOpenChat: (chatId: string) => void
  onNewChat: () => void
}

export default function ChatsScreen({ onOpenChat, onNewChat }: Props) {
  const user = useAuthStore(s => s.user)
  const chats = useChatStore(s => s.chats)
  const setChats = useChatStore(s => s.setChats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChats()
  }, [])

  const loadChats = async () => {
    try {
      const data = await api.getChats()
      setChats(data)
    } catch (err) {
      console.error('Failed to load chats:', err)
    }
    setLoading(false)
  }

  const getChatTitle = (chat: Chat) => {
    if (chat.type === 'group') return chat.name || 'Группа'
    const other = chat.members.find(m => m.id !== user?.id)
    return other?.displayName || 'Чат'
  }

  const getChatAvatar = (chat: Chat) => {
    if (chat.type === 'group') return { letter: chat.name?.[0] || 'Г', color: '#7C3AED' }
    const other = chat.members.find(m => m.id !== user?.id)
    return { letter: (other?.displayName?.[0] || '?').toUpperCase(), color: other?.avatarColor || '#7C3AED' }
  }

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'вчера'
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Чаты</h1>
          {user?.quizStreak ? (
            <span style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 700 }}>
              🔥 {user.quizStreak}
            </span>
          ) : null}
        </div>
        <button
          onClick={onNewChat}
          style={{
            width: 40, height: 40,
            borderRadius: 12,
            background: 'var(--accent)',
            border: 'none',
            color: 'white',
            fontSize: 24,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          +
        </button>
      </div>

      {/* Chat list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Загрузка...
          </div>
        ) : chats.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
              Пока нет чатов
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Нажми + чтобы начать общение
            </p>
          </div>
        ) : (
          chats.map((chat, i) => {
            const avatar = getChatAvatar(chat)
            return (
              <div
                key={chat.id}
                onClick={() => onOpenChat(chat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 20px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s',
                  animation: `fadeIn 0.3s ease-out ${i * 0.05}s both`
                }}
                onPointerDown={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onPointerUp={e => (e.currentTarget.style.background = '')}
                onPointerLeave={e => (e.currentTarget.style.background = '')}
              >
                <div className="avatar" style={{ background: avatar.color }}>
                  {chat.type === 'group' ? '👥' : avatar.letter}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{getChatTitle(chat)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                      {formatTime(chat.lastMessageAt)}
                    </span>
                  </div>
                  {chat.lastMessage && (
                    <p style={{
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {chat.lastMessage}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
