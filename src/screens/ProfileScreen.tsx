import React from 'react'
import { useAuthStore } from '../stores/authStore'

export default function ProfileScreen() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)

  if (!user) return null

  const accuracy = user.totalQuizAnswered > 0
    ? Math.round((user.totalQuizCorrect / user.totalQuizAnswered) * 100)
    : 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900 }}>Профиль</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        {/* Avatar & name */}
        <div style={{ textAlign: 'center', marginBottom: 32 }} className="animate-fadeIn">
          <div
            className="avatar avatar-lg"
            style={{ background: user.avatarColor, margin: '0 auto', marginBottom: 12, width: 80, height: 80, fontSize: 32 }}
          >
            {user.displayName[0]?.toUpperCase()}
          </div>
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
