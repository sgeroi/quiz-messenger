import React, { useState } from 'react'
import { api } from '../api'
import { useAuthStore } from '../stores/authStore'
import QuizGate from './QuizGate'

type Mode = 'login' | 'register' | 'quiz'

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [nickname, setNickname] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [quizData, setQuizData] = useState<any>(null)
  const setAuth = useAuthStore(s => s.setAuth)

  const handleLogin = async () => {
    if (!nickname.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const data = await api.login(nickname.trim(), password)
      setQuizData(data)
      setMode('quiz')
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    if (!nickname.trim() || !displayName.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const data = await api.register(nickname.trim(), displayName.trim(), password)
      setAuth(data.token, data.user)
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleQuizComplete = (token: string, user: any) => {
    setAuth(token, user)
  }

  if (mode === 'quiz' && quizData) {
    return <QuizGate quizData={quizData} onComplete={handleQuizComplete} onBack={() => setMode('login')} />
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg-primary)'
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }} className="animate-fadeIn">
        <img
          src="/logo.png"
          alt="Квиз, плиз!"
          style={{
            width: 64, height: 64,
            borderRadius: 16,
            margin: '0 auto 16px',
            display: 'block',
            objectFit: 'cover'
          }}
        />
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 2, letterSpacing: '-0.5px' }}>
          Квиз, плиз!
        </h1>
        <p style={{
          color: 'var(--accent-light)',
          fontSize: 13,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '3px'
        }}>
          мессенджер
        </p>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="animate-fadeIn">
        <input
          className="input"
          placeholder="Никнейм"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
        />

        {mode === 'register' && (
          <input
            className="input"
            placeholder="Имя (как видят другие)"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
        )}

        <input
          className="input"
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
        />

        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.1)',
            borderRadius: 12,
            color: 'var(--red)',
            fontSize: 14,
            fontWeight: 600
          }} className="animate-shake">
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={mode === 'login' ? handleLogin : handleRegister}
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          {loading ? '...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>

        <button
          className="btn btn-ghost"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError('')
          }}
        >
          {mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>

      {/* Info */}
      <div style={{
        marginTop: 32,
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 13,
        lineHeight: 1.5
      }}>
        💡 При каждом входе — вопрос на эрудицию!
        <br />Собирай серию правильных ответов 🔥
      </div>
    </div>
  )
}
