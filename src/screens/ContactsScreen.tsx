import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuthStore } from '../stores/authStore'

interface UserInfo {
  id: string
  nickname: string
  displayName: string
  avatarColor: string
  avatarUrl?: string | null
  quizStreak?: number
  totalQuizCorrect?: number
  totalQuizAnswered?: number
  lastSeen?: string
}

interface Props {
  onStartChat: (userId: string) => void
}

export default function ContactsScreen({ onStartChat }: Props) {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null)
  const me = useAuthStore(s => s.user)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await api.getAllUsers()
      setUsers(data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const formatLastSeen = (ls?: string) => {
    if (!ls) return 'не в сети'
    const d = new Date(ls + 'Z')
    const now = Date.now()
    const diff = now - d.getTime()
    if (diff < 5 * 60 * 1000) return 'в сети'
    if (diff < 60 * 60 * 1000) return `${Math.round(diff / 60000)} мин назад`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.round(diff / 3600000)} ч назад`
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
  }

  // User profile modal
  if (selectedUser) {
    const u = selectedUser
    const accuracy = (u.totalQuizAnswered || 0) > 0
      ? Math.round(((u.totalQuizCorrect || 0) / (u.totalQuizAnswered || 1)) * 100)
      : 0

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)'
        }}>
          <button onClick={() => setSelectedUser(null)} style={{
            background: 'none', border: 'none', color: 'var(--accent)',
            fontSize: 24, cursor: 'pointer', padding: '4px 8px', marginLeft: -8
          }}>←</button>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Профиль</h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }} className="animate-fadeIn">
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 12px',
              overflow: 'hidden',
              background: u.avatarUrl ? 'transparent' : u.avatarColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 800, color: 'white',
              border: '3px solid var(--border)'
            }}>
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : u.displayName[0]?.toUpperCase()}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>{u.displayName}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>@{u.nickname}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              {formatLastSeen(u.lastSeen)}
            </p>
          </div>

          {/* Quiz stats */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 20, padding: 20,
            border: '1px solid var(--border)', marginBottom: 16
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>🧠 Статистика квизов</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--orange)' }}>
                  🔥 {u.quizStreak || 0}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Серия</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--green)' }}>
                  {u.totalQuizCorrect || 0}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Правильно</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)' }}>
                  {accuracy}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Точность</div>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={() => { onStartChat(u.id); setSelectedUser(null) }}
            style={{ width: '100%' }}>
            💬 Написать
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900 }}>Контакты</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Все участники ({users.length})
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Пока никто не зарегистрирован</p>
          </div>
        ) : (
          users.map(u => (
            <div key={u.id} onClick={() => setSelectedUser(u)} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 20px', borderBottom: '1px solid var(--border)',
              cursor: 'pointer', transition: 'background 0.15s'
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: u.avatarUrl ? 'transparent' : u.avatarColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800, color: 'white', overflow: 'hidden'
              }}>
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : u.displayName[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{u.displayName}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{u.nickname}</div>
              </div>
              <span style={{
                fontSize: 12,
                color: formatLastSeen(u.lastSeen) === 'в сети' ? 'var(--green)' : 'var(--text-muted)'
              }}>
                {formatLastSeen(u.lastSeen)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
