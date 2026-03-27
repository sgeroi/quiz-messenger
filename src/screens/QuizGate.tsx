import React, { useState, useEffect } from 'react'
import { api } from '../api'

interface Props {
  quizData: {
    quizToken: string
    question: { id: number; question: string; options: string[] }
    user: { displayName: string; quizStreak: number }
  }
  onComplete: (token: string, user: any) => void
  onBack: () => void
}

export default function QuizGate({ quizData, onComplete, onBack }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<{ isCorrect: boolean; streak: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(15)

  useEffect(() => {
    if (result) return
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          handleAnswer(-1) // auto-submit wrong
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [result])

  const handleAnswer = async (index: number) => {
    if (selected !== null) return
    setSelected(index)
    setLoading(true)
    try {
      const data = await api.verifyQuiz(quizData.quizToken, index)
      setResult({ isCorrect: data.isCorrect, streak: data.streak })
      // Auto-proceed after delay
      setTimeout(() => {
        onComplete(data.token, data.user)
      }, data.isCorrect ? 1500 : 2000)
    } catch (err: any) {
      onBack()
    }
    setLoading(false)
  }

  const letters = ['А', 'Б', 'В', 'Г']

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      background: 'var(--bg-primary)'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }} className="animate-fadeIn">
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>
          Привет, {quizData.user.displayName}! 👋
        </p>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>
          Ответь, чтобы войти
        </h2>
        {quizData.user.quizStreak > 0 && (
          <div style={{ marginTop: 8 }}>
            <span className="badge badge-accent">
              🔥 Серия: {quizData.user.quizStreak}
            </span>
          </div>
        )}
      </div>

      {/* Timer */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6,
          fontSize: 13,
          color: 'var(--text-secondary)'
        }}>
          <span>Время</span>
          <span style={{
            color: countdown <= 5 ? 'var(--red)' : 'var(--text-secondary)',
            fontWeight: countdown <= 5 ? 700 : 400
          }}>
            {countdown}с
          </span>
        </div>
        <div className="timer-bar">
          <div
            className="timer-bar-fill"
            style={{ width: `${(countdown / 15) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 20,
        padding: '24px 20px',
        marginBottom: 20,
        border: '1px solid var(--border)'
      }} className="animate-fadeIn">
        <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5 }}>
          {quizData.question.question}
        </p>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {quizData.question.options.map((opt, i) => {
          let cls = 'quiz-option'
          if (result) {
            if (i === result.isCorrect ? selected : -1) cls += ' correct'
            // Show correct answer
            // We don't know correct index from client side in this flow
            // but we know if user was correct
            if (i === selected && result.isCorrect) cls += ' correct'
            if (i === selected && !result.isCorrect) cls += ' wrong'
          } else if (i === selected) {
            cls += ' selected'
          }

          return (
            <button
              key={i}
              className={cls}
              onClick={() => handleAnswer(i)}
              disabled={selected !== null}
              style={{ animation: `fadeIn 0.3s ease-out ${i * 0.08}s both` }}
            >
              <span className="quiz-option-letter">{letters[i]}</span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>

      {/* Result */}
      {result && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          marginTop: 16,
          borderRadius: 16,
          background: result.isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        }} className="animate-fadeIn">
          <div style={{ fontSize: 40, marginBottom: 8 }}>
            {result.isCorrect ? '🎉' : '😅'}
          </div>
          <p style={{
            fontSize: 18,
            fontWeight: 800,
            color: result.isCorrect ? 'var(--green)' : 'var(--red)'
          }}>
            {result.isCorrect ? 'Правильно!' : 'Неправильно!'}
          </p>
          {result.isCorrect && result.streak > 1 && (
            <p style={{ color: 'var(--orange)', fontWeight: 700, marginTop: 4 }}>
              🔥 Серия: {result.streak}!
            </p>
          )}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
            Входим...
          </p>
        </div>
      )}
    </div>
  )
}
