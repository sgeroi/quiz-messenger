import React, { useRef, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../api'

export default function ProfileScreen() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const updateUser = useAuthStore(s => s.updateUser)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  if (!user) return null

  const accuracy = user.totalQuizAnswered > 0
    ? Math.round((user.totalQuizCorrect / user.totalQuizAnswered) * 100)
    : 0

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const updatedUser = await api.uploadAvatar(file)
      updateUser(updatedUser)
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900 }}>Профиль</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        {/* Avatar & name */}
        <div style={{ textAlign: 'center', marginBottom: 32 }} className="animate-fadeIn">
          <div
            onClick={handleAvatarClick}
            style={{
              width: 80, height: 80,
              borderRadius: '50%',
              margin: '0 auto 12px',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              background: user.avatarUrl ? 'transparent' : user.avatarColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
              color: 'white',
              border: '3px solid var(--border)',
              transition: 'border-color 0.2s'
            }}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              user.displayName[0]?.toUpperCase()
            )}
            {/* Hover overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: uploading ? 1 : 0,
              transition: 'opacity 0.2s',
              fontSize: 14,
              fontWeight: 700
            }}>
              {uploading ? '...' : '📷'}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            Нажми на аватар чтобы загрузить фото
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{user.displayName}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>@{user.nickname}</p>
        </div>

        {/* Quiz stats */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 20,
          padding: '20px',
          border: '1px solid var(--border)',
          marginBottom: 16
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>🧠 Статистика квизов</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--orange)' }}>
                🔥 {user.quizStreak}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Серия</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--green)' }}>
                {user.totalQuizCorrect}
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

        {/* Progress */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 20,
          padding: '20px',
          border: '1px solid var(--border)',
          marginBottom: 24
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>🏆 Уровень эрудита</h3>
          {(() => {
            const levels = [
              { name: 'Новичок', min: 0, emoji: '🌱' },
              { name: 'Знаток', min: 5, emoji: '📚' },
              { name: 'Эрудит', min: 15, emoji: '🎓' },
              { name: 'Мудрец', min: 30, emoji: '🦉' },
              { name: 'Гений', min: 50, emoji: '🧠' },
              { name: 'Легенда', min: 100, emoji: '👑' },
            ]
            const current = [...levels].reverse().find(l => user.totalQuizCorrect >= l.min) || levels[0]
            const nextLevel = levels[levels.indexOf(current) + 1]
            const progress = nextLevel
              ? ((user.totalQuizCorrect - current.min) / (nextLevel.min - current.min)) * 100
              : 100

            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    {current.emoji} {current.name}
                  </span>
                  {nextLevel && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      до «{nextLevel.name}»: {nextLevel.min - user.totalQuizCorrect}
                    </span>
                  )}
                </div>
                <div className="progress">
                  <div className="progress-fill" style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
              </>
            )
          })()}
        </div>

        {/* Logout */}
        <button
          className="btn btn-secondary"
          onClick={logout}
          style={{ width: '100%' }}
        >
          Выйти
        </button>
      </div>
    </div>
  )
}
