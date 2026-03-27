import React, { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../api'
import { useAuthStore } from '../stores/authStore'
import { useChatStore, Message } from '../stores/chatStore'
import { getSocket } from '../socket'

interface Props {
  chatId: string
  onBack: () => void
}

interface QuizQuestion {
  index: number
  total: number
  category: string
  question: string
  options: string[]
  timeLimit: number
}

interface QuizState {
  active: boolean
  question: QuizQuestion | null
  selected: number | null
  answerResult: { isCorrect: boolean } | null
  correctAnswer: number | null
  timeLeft: number
  leaderboard: any[]
  finished: any | null
  countdown: number | null
  participants: number
}

const emptyMessages: Message[] = []
const letters = ['А', 'Б', 'В', 'Г']

export default function ChatRoom({ chatId, onBack }: Props) {
  const user = useAuthStore(s => s.user)
  const chats = useChatStore(s => s.chats)
  const messages = useChatStore(s => s.messages[chatId]) ?? emptyMessages
  const setMessages = useChatStore(s => s.setMessages)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [quiz, setQuiz] = useState<QuizState>({
    active: false, question: null, selected: null, answerResult: null,
    correctAnswer: null, timeLeft: 0, leaderboard: [], finished: null,
    countdown: null, participants: 1
  })

  const chat = chats.find(c => c.id === chatId)
  const otherMember = chat?.members.find(m => m.id !== user?.id)
  const chatTitle = chat?.type === 'group' ? (chat.name || 'Группа') : (otherMember?.displayName || 'Чат')
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
        } else setTyping(null)
      }
    }

    const onStarted = (data: any) => {
      if (data.chatId !== chatId) return
      setQuiz(q => ({ ...q, active: true, countdown: 5, participants: 1, finished: null, leaderboard: [] }))
    }

    const onQuestion = (data: any) => {
      if (data.chatId !== chatId) return
      setQuiz(q => ({
        ...q, question: data, selected: null, answerResult: null,
        correctAnswer: null, timeLeft: data.timeLimit, countdown: null
      }))
    }

    const onAnswerResult = (data: any) => {
      if (data.chatId !== chatId) return
      setQuiz(q => ({ ...q, answerResult: { isCorrect: data.isCorrect } }))
    }

    const onQuestionResult = (data: any) => {
      if (data.chatId !== chatId) return
      setQuiz(q => ({ ...q, leaderboard: data.leaderboard, correctAnswer: data.correctAnswer, question: null }))
    }

    const onFinished = (data: any) => {
      if (data.chatId !== chatId) return
      setQuiz(q => ({ ...q, active: false, finished: data, question: null, countdown: null }))
    }

    const onPlayerJoined = (data: any) => {
      if (data.chatId !== chatId) return
      setQuiz(q => ({ ...q, participants: data.participants }))
    }

    socket?.on('typing:update', handleTyping)
    socket?.on('quiz:started', onStarted)
    socket?.on('quiz:question', onQuestion)
    socket?.on('quiz:answerResult', onAnswerResult)
    socket?.on('quiz:questionResult', onQuestionResult)
    socket?.on('quiz:finished', onFinished)
    socket?.on('quiz:playerJoined', onPlayerJoined)

    return () => {
      socket?.off('typing:update', handleTyping)
      socket?.off('quiz:started', onStarted)
      socket?.off('quiz:question', onQuestion)
      socket?.off('quiz:answerResult', onAnswerResult)
      socket?.off('quiz:questionResult', onQuestionResult)
      socket?.off('quiz:finished', onFinished)
      socket?.off('quiz:playerJoined', onPlayerJoined)
    }
  }, [chatId])

  // Quiz timer
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (!quiz.question) return
    timerRef.current = setInterval(() => {
      setQuiz(q => {
        if (!q.question || q.timeLeft <= 0) { if (timerRef.current) clearInterval(timerRef.current); return q }
        return { ...q, timeLeft: Math.max(0, q.timeLeft - 0.1) }
      })
    }, 100)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [quiz.question?.index])

  // Countdown
  useEffect(() => {
    if (quiz.countdown === null || quiz.countdown <= 0) return
    const t = setTimeout(() => setQuiz(q => ({ ...q, countdown: (q.countdown ?? 1) - 1 })), 1000)
    return () => clearTimeout(t)
  }, [quiz.countdown])

  const messagesLength = messages.length
  const quizQuestionIdx = quiz.question?.index
  const quizLeaderboardLen = quiz.leaderboard.length
  const quizFinished = quiz.finished
  useEffect(() => { scrollToBottom() }, [messagesLength, quizQuestionIdx, quizLeaderboardLen, quizFinished])

  const loadMessages = async () => {
    try { setMessages(chatId, await api.getMessages(chatId)) } catch {}
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
    typingTimeout.current = setTimeout(() => socket?.emit('typing:stop', { chatId }), 2000)
  }

  const startQuiz = () => {
    const socket = getSocket()
    socket?.emit('quiz:start', { chatId, questionCount: 5 })
    socket?.emit('quiz:join', { chatId })
  }

  const submitAnswer = (index: number) => {
    if (quiz.selected !== null) return
    setQuiz(q => ({ ...q, selected: index }))
    getSocket()?.emit('quiz:answer', { chatId, answerIndex: index })
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
        <div key={msg.id} className="bubble-system">
          {msg.type === 'quiz_start' ? '🎯 ' : msg.type === 'quiz_result' ? '🏆 ' : ''}{msg.content}
        </div>
      )
    }

    const showName = chat?.type === 'group' && !isMine
    const prevMsg = messages[idx - 1]
    const sameSender = prevMsg && prevMsg.senderId === msg.senderId && prevMsg.type !== 'system'

    return (
      <div key={msg.id} style={{
        display: 'flex', flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        marginTop: sameSender ? 2 : 8
      }}>
        {showName && !sameSender && (
          <span style={{ fontSize: 12, fontWeight: 700, color: msg.senderColor || 'var(--accent)', marginBottom: 2, marginLeft: 4 }}>
            {msg.senderName}
          </span>
        )}
        <div className={`bubble ${isMine ? 'bubble-mine' : 'bubble-other'}`}>
          {msg.content}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginLeft: 4, marginRight: 4 }}>
          {formatTime(msg.createdAt)}
        </span>
      </div>
    )
  }

  // Inline quiz card rendered in the message feed
  const renderQuizInline = () => {
    if (!quiz.active && !quiz.finished) return null

    // Countdown
    if (quiz.countdown !== null && quiz.countdown > 0) {
      return (
        <div key="quiz-countdown" style={{
          margin: '12px 0', padding: '20px', borderRadius: 20,
          background: 'var(--bg-secondary)', border: '1px solid var(--accent)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-light)', marginBottom: 8 }}>
            🎯 Викторина начинается!
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--accent)' }} className="animate-pulse">
            {quiz.countdown}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Участников: {quiz.participants}
          </div>
        </div>
      )
    }

    // Active question
    if (quiz.question) {
      const q = quiz.question
      return (
        <div key={`quiz-q-${q.index}`} style={{
          margin: '12px 0', padding: '16px', borderRadius: 20,
          background: 'var(--bg-secondary)', border: '1px solid var(--accent)'
        }} className="animate-fadeIn">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="badge badge-accent">{q.category}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {q.index}/{q.total}
            </span>
          </div>
          <div className="timer-bar" style={{ marginBottom: 12 }}>
            <div className="timer-bar-fill" style={{ width: `${(quiz.timeLeft / q.timeLimit) * 100}%` }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4, marginBottom: 12 }}>
            {q.question}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {q.options.map((opt, i) => {
              let cls = 'quiz-option'
              if (quiz.answerResult) {
                if (i === quiz.selected && quiz.answerResult.isCorrect) cls += ' correct'
                if (i === quiz.selected && !quiz.answerResult.isCorrect) cls += ' wrong'
              } else if (i === quiz.selected) cls += ' selected'

              return (
                <button key={i} className={cls} onClick={() => submitAnswer(i)} disabled={quiz.selected !== null}
                  style={{ padding: '12px 14px', fontSize: 14 }}>
                  <span className="quiz-option-letter" style={{ width: 28, height: 28, fontSize: 12 }}>{letters[i]}</span>
                  <span>{opt}</span>
                </button>
              )
            })}
          </div>
          {quiz.answerResult && (
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 15, fontWeight: 800,
              color: quiz.answerResult.isCorrect ? 'var(--green)' : 'var(--red)' }}>
              {quiz.answerResult.isCorrect ? '✅ Верно!' : '❌ Неверно'}
            </div>
          )}
        </div>
      )
    }

    // Leaderboard between questions (no finished yet)
    if (quiz.leaderboard.length > 0 && !quiz.finished) {
      return (
        <div key="quiz-leaderboard" style={{
          margin: '12px 0', padding: '16px', borderRadius: 20,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          textAlign: 'center'
        }} className="animate-fadeIn">
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>📊 Результаты раунда</div>
          {quiz.leaderboard.map((e, i) => (
            <div key={e.odId} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10, marginBottom: 4,
              background: i === 0 ? 'rgba(245,158,11,0.08)' : 'transparent'
            }}>
              <span style={{ fontSize: 16, width: 24 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`}</span>
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>{e.nickname}</span>
              {e.lastAnswer && (
                <span style={{ fontSize: 12, color: e.lastAnswer.correct ? 'var(--green)' : 'var(--red)' }}>
                  {e.lastAnswer.correct ? `+${e.lastAnswer.points}` : '✕'}
                </span>
              )}
              <span style={{ fontWeight: 800, color: 'var(--accent-light)', fontSize: 14 }}>{e.score}</span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Следующий вопрос...</div>
        </div>
      )
    }

    // Final results
    if (quiz.finished) {
      const f = quiz.finished
      return (
        <div key="quiz-finished" style={{
          margin: '12px 0', padding: '20px', borderRadius: 20,
          background: 'var(--bg-secondary)', border: '2px solid var(--orange)',
          textAlign: 'center'
        }} className="animate-fadeIn">
          <div style={{ fontSize: 36, marginBottom: 4 }}>🏆</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Викторина завершена!</div>
          {f.winner && (
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--orange)', marginBottom: 12 }}>
              Победитель: {f.winner.nickname} — {f.winner.score} очков
            </div>
          )}
          {f.leaderboard.map((e: any, i: number) => (
            <div key={e.odId} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10, marginBottom: 4,
              background: i === 0 ? 'rgba(245,158,11,0.1)' : 'transparent'
            }}>
              <span style={{ fontSize: 18, width: 28 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{e.nickname}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{e.correctCount}/{e.totalQuestions} правильно</div>
              </div>
              <span style={{ fontWeight: 900, fontSize: 16, color: 'var(--accent-light)' }}>{e.score}</span>
            </div>
          ))}
          <button onClick={() => setQuiz(q => ({ ...q, finished: null }))}
            style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
            Скрыть
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }} className="animate-slideIn">
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)'
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: 'var(--accent)',
          fontSize: 24, cursor: 'pointer', padding: '4px 8px', marginLeft: -8
        }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>{chatTitle}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {typing ? `${typing} печатает...` : chatSubtitle}
          </p>
        </div>
        <button onClick={startQuiz} disabled={quiz.active} style={{
          width: 40, height: 40, borderRadius: 12,
          background: quiz.active ? 'var(--accent-dark)' : 'var(--bg-card)',
          border: `1px solid ${quiz.active ? 'var(--accent)' : 'var(--border)'}`,
          fontSize: 20, cursor: quiz.active ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: quiz.active ? 0.6 : 1
        }} title="Начать викторину">🎯</button>
      </div>

      {/* Messages + inline quiz */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px',
        display: 'flex', flexDirection: 'column'
      }}>
        {messages.length === 0 && !quiz.active && !quiz.finished && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>👋</div>
            <p style={{ fontSize: 14 }}>Начните общение!</p>
          </div>
        )}
        {messages.map((msg, i) => renderMessage(msg, i))}
        {renderQuizInline()}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)'
      }}>
        <input className="input" placeholder="Сообщение..." value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          style={{ flex: 1, borderRadius: 20, padding: '12px 18px' }} />
        <button onClick={sendMessage} disabled={!input.trim()} style={{
          width: 48, height: 48, borderRadius: '50%',
          background: input.trim() ? 'var(--accent)' : 'var(--bg-card)',
          border: 'none', color: 'white', fontSize: 20,
          cursor: input.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'background 0.2s'
        }}>↑</button>
      </div>
    </div>
  )
}
