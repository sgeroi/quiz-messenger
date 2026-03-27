import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api'

interface QuizQuestion {
  id: number
  question: string
  options: string[]
}

interface Props {
  quizData: {
    quizToken: string
    question: QuizQuestion
    user: { displayName: string; quizStreak: number }
  }
  onComplete: (token: string, user: any) => void
  onBack: () => void
}

export default function QuizGate({ quizData, onComplete, onBack }: Props) {
  const [quizToken, setQuizToken] = useState(quizData.quizToken)
  const [question, setQuestion] = useState<QuizQuestion>(quizData.question)
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [countdown, setCountdown] = useState(15)
  const [attempts, setAttempts] = useState(0)
  const [streak, setStreak] = useState(quizData.user.quizStreak)

  const answeredRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef(15)

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const tokenRef = useRef(quizData.quizToken)

  const submitAnswer = useCallback(async (index: number) => {
    if (answeredRef.current) return
    answeredRef.current = true
    clearTimer()
    setSelected(index)

    const token = tokenRef.current
    try {
      const data = await api.verifyQuiz(token, index)

      if (data.isCorrect) {
        setResult('correct')
        setStreak(data.streak)
        setTimeout(() => {
          onComplete(data.token, data.user)
        }, 1500)
      } else {
        setResult('wrong')
        setAttempts(prev => prev + 1)
        setTimeout(() => {
          // Update token ref before resetting answered flag
          tokenRef.current = data.quizToken
          setQuizToken(data.quizToken)
          setQuestion(data.question)
          setSelected(null)
          setResult(null)
          // Reset answered flag LAST
          answeredRef.current = false
        }, 1800)
      }
    } catch {
      onBack()
    }
  }, [onComplete, onBack])

  // Start/restart timer when question changes
  useEffect(() => {
    countdownRef.current = 15
    setCountdown(15)
    clearTimer()

    timerRef.current = setInterval(() => {
      if (answeredRef.current) { clearTimer(); return }
      countdownRef.current -= 1
      setCountdown(countdownRef.current)
      if (countdownRef.current <= 0) {
        clearTimer()
        submitAnswer(-1)
      }
    }, 1000)

    return clearTimer
  }, [question.id, submitAnswer])

  const handleClick = (index: number) => {
    submitAnswer(index)
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
          Ответь правильно, чтобы войти
        </h2>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {streak > 0 && (
            <span className="badge badge-accent">
              🔥 Серия: {streak}
            </span>
          )}
          {attempts > 0 && (
            <span className="badge badge-red">
              Попытка {attempts + 1}
            </span>
          )}
        </div>
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
      <div
        key={question.id}
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 20,
          padding: '24px 20px',
          marginBottom: 20,
          border: '1px solid var(--border)'
        }}
        className="animate-fadeIn"
      >
        <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5 }}>
          {question.question}
        </p>
      </div>

      {/* Options */}
      <div key={`opts-${question.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {question.options.map((opt, i) => {
          let cls = 'quiz-option'
          if (result !== null) {
            if (i === selected && result === 'correct') cls += ' correct'
            if (i === selected && result === 'wrong') cls += ' wrong'
          } else if (i === selected) {
            cls += ' selected'
          }

          return (
            <button
              key={`${question.id}-${i}`}
              className={cls}
              onClick={() => handleClick(i)}
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
          background: result === 'correct' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        }} className="animate-fadeIn">
          <div style={{ fontSize: 40, marginBottom: 8 }}>
            {result === 'correct' ? '🎉' : '😅'}
          </div>
          <p style={{
            fontSize: 18,
            fontWeight: 800,
            color: result === 'correct' ? 'var(--green)' : 'var(--red)'
          }}>
            {result === 'correct' ? 'Правильно!' : 'Неправильно!'}
          </p>
          {result === 'correct' && streak > 1 && (
            <p style={{ color: 'var(--orange)', fontWeight: 700, marginTop: 4 }}>
              🔥 Серия: {streak}!
            </p>
          )}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
            {result === 'correct' ? 'Входим...' : 'Следующий вопрос...'}
          </p>
        </div>
      )}
    </div>
  )
}
