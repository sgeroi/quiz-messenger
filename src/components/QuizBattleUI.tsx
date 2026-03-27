import React, { useState, useEffect, useCallback } from 'react'
import { getSocket } from '../socket'

interface Props {
  chatId: string
  onClose: () => void
}

type Stage = 'lobby' | 'question' | 'result' | 'leaderboard' | 'finished'

interface QuestionData {
  index: number
  total: number
  category: string
  question: string
  options: string[]
  timeLimit: number
}

interface LeaderboardEntry {
  odId: string
  nickname: string
  score: number
  lastAnswer?: { correct: boolean; points: number; time: string } | null
  correctCount?: number
  totalQuestions?: number
}

export default function QuizBattleUI({ chatId, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('lobby')
  const [questionCount, setQuestionCount] = useState(5)
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean } | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null)
  const [finalResults, setFinalResults] = useState<any>(null)
  const [participants, setParticipants] = useState(1)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onQuestion = (data: any) => {
      if (data.chatId !== chatId) return
      setStage('question')
      setCurrentQuestion(data)
      setSelected(null)
      setAnswerResult(null)
      setCorrectAnswer(null)
      setTimeLeft(data.timeLimit)
      setCountdown(null)
    }

    const onAnswerResult = (data: any) => {
      if (data.chatId !== chatId) return
      setAnswerResult({ isCorrect: data.isCorrect })
    }

    const onQuestionResult = (data: any) => {
      if (data.chatId !== chatId) return
      setStage('leaderboard')
      setLeaderboard(data.leaderboard)
      setCorrectAnswer(data.correctAnswer)
    }

    const onFinished = (data: any) => {
      if (data.chatId !== chatId) return
      setStage('finished')
      setFinalResults(data)
    }

    const onPlayerJoined = (data: any) => {
      if (data.chatId !== chatId) return
      setParticipants(data.participants)
    }

    socket.on('quiz:question', onQuestion)
    socket.on('quiz:answerResult', onAnswerResult)
    socket.on('quiz:questionResult', onQuestionResult)
    socket.on('quiz:finished', onFinished)
    socket.on('quiz:playerJoined', onPlayerJoined)

    return () => {
      socket.off('quiz:question', onQuestion)
      socket.off('quiz:answerResult', onAnswerResult)
      socket.off('quiz:questionResult', onQuestionResult)
      socket.off('quiz:finished', onFinished)
      socket.off('quiz:playerJoined', onPlayerJoined)
    }
  }, [chatId])

  // Timer
  useEffect(() => {
    if (stage !== 'question' || !currentQuestion) return
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) { clearInterval(timer); return 0 }
        return prev - 0.1
      })
    }, 100)
    return () => clearInterval(timer)
  }, [stage, currentQuestion])

  // Countdown before start
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const startQuiz = useCallback(() => {
    const socket = getSocket()
    socket?.emit('quiz:start', { chatId, questionCount })
    socket?.emit('quiz:join', { chatId })
    setCountdown(5)
    setStage('lobby')
  }, [chatId, questionCount])

  const submitAnswer = useCallback((index: number) => {
    if (selected !== null) return
    setSelected(index)
    const socket = getSocket()
    socket?.emit('quiz:answer', { chatId, answerIndex: index })
  }, [chatId, selected])

  const letters = ['А', 'Б', 'В', 'Г']

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'var(--bg-primary)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)'
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>🎯 Викторина</h2>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 24, cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Lobby */}
        {stage === 'lobby' && !countdown && (
          <div style={{ textAlign: 'center' }} className="animate-fadeIn">
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎯</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Викторина</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 24 }}>
              Проверь эрудицию! Отвечай быстрее — получай больше очков.
            </p>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>
                Количество вопросов
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {[3, 5, 7, 10].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    style={{
                      width: 48, height: 48,
                      borderRadius: 14,
                      border: `2px solid ${questionCount === n ? 'var(--accent)' : 'var(--border)'}`,
                      background: questionCount === n ? 'rgba(168,85,247,0.2)' : 'var(--bg-card)',
                      color: questionCount === n ? 'var(--accent-light)' : 'var(--text-secondary)',
                      fontSize: 18, fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" onClick={startQuiz} style={{ width: '100%' }}>
              🚀 Запустить викторину
            </button>
          </div>
        )}

        {/* Countdown */}
        {stage === 'lobby' && countdown !== null && countdown > 0 && (
          <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{
              fontSize: 80, fontWeight: 900, color: 'var(--accent)',
              animation: 'pulse 0.6s ease-in-out'
            }}>
              {countdown}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginTop: 8 }}>
              Приготовьтесь!
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
              Участников: {participants}
            </p>
          </div>
        )}

        {/* Question */}
        {stage === 'question' && currentQuestion && (
          <div className="animate-fadeIn">
            {/* Progress & timer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="badge badge-accent">
                {currentQuestion.category}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {currentQuestion.index} / {currentQuestion.total}
              </span>
            </div>

            <div className="timer-bar" style={{ marginBottom: 20 }}>
              <div
                className="timer-bar-fill"
                style={{ width: `${(timeLeft / currentQuestion.timeLimit) * 100}%` }}
              />
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 20,
              padding: '24px 20px',
              marginBottom: 20,
              border: '1px solid var(--border)'
            }}>
              <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5 }}>
                {currentQuestion.question}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQuestion.options.map((opt, i) => {
                let cls = 'quiz-option'
                if (answerResult) {
                  if (i === selected && answerResult.isCorrect) cls += ' correct'
                  if (i === selected && !answerResult.isCorrect) cls += ' wrong'
                  if (correctAnswer !== null && i === correctAnswer) cls += ' correct'
                } else if (i === selected) {
                  cls += ' selected'
                }

                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => submitAnswer(i)}
                    disabled={selected !== null}
                  >
                    <span className="quiz-option-letter">{letters[i]}</span>
                    <span>{opt}</span>
                  </button>
                )
              })}
            </div>

            {answerResult && (
              <div style={{
                textAlign: 'center', marginTop: 16, fontSize: 18, fontWeight: 800,
                color: answerResult.isCorrect ? 'var(--green)' : 'var(--red)'
              }}>
                {answerResult.isCorrect ? '✅ Верно!' : '❌ Неверно'}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard between questions */}
        {stage === 'leaderboard' && (
          <div className="animate-fadeIn" style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>📊 Промежуточные результаты</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leaderboard.map((entry, i) => (
                <div key={entry.odId} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: 'var(--bg-card)',
                  borderRadius: 14, border: `1px solid ${i === 0 ? 'var(--orange)' : 'var(--border)'}`
                }}>
                  <span style={{ fontSize: 20, fontWeight: 900, width: 32 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </span>
                  <span style={{ flex: 1, textAlign: 'left', fontWeight: 700 }}>{entry.nickname}</span>
                  {entry.lastAnswer && (
                    <span style={{ fontSize: 13, color: entry.lastAnswer.correct ? 'var(--green)' : 'var(--red)' }}>
                      {entry.lastAnswer.correct ? `+${entry.lastAnswer.points}` : '✕'}
                    </span>
                  )}
                  <span style={{ fontWeight: 800, color: 'var(--accent-light)' }}>{entry.score}</span>
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 16 }}>
              Следующий вопрос через 5 секунд...
            </p>
          </div>
        )}

        {/* Final results */}
        {stage === 'finished' && finalResults && (
          <div className="animate-fadeIn" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>🏆</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>Викторина завершена!</h2>
            {finalResults.winner && (
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--orange)', marginBottom: 24 }}>
                Победитель: {finalResults.winner.nickname} ({finalResults.winner.score} очков)
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {finalResults.leaderboard.map((entry: LeaderboardEntry, i: number) => (
                <div key={entry.odId} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', background: 'var(--bg-card)',
                  borderRadius: 14,
                  border: `1px solid ${i === 0 ? 'var(--orange)' : 'var(--border)'}`,
                  ...(i === 0 ? { background: 'rgba(245,158,11,0.08)' } : {})
                }}>
                  <span style={{ fontSize: 24, fontWeight: 900, width: 32 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700 }}>{entry.nickname}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {entry.correctCount}/{entry.totalQuestions} правильно
                    </div>
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--accent-light)' }}>
                    {entry.score}
                  </span>
                </div>
              ))}
            </div>

            <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
