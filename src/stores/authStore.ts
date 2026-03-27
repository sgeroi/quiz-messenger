import { create } from 'zustand'

interface User {
  id: string
  nickname: string
  displayName: string
  avatarColor: string
  quizStreak: number
  totalQuizCorrect: number
  totalQuizAnswered: number
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  setAuth: (token: string, user: User) => void
  logout: () => void
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('qm_token'),
  user: JSON.parse(localStorage.getItem('qm_user') || 'null'),
  isAuthenticated: !!localStorage.getItem('qm_token'),
  setAuth: (token, user) => {
    localStorage.setItem('qm_token', token)
    localStorage.setItem('qm_user', JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },
  logout: () => {
    localStorage.removeItem('qm_token')
    localStorage.removeItem('qm_user')
    set({ token: null, user: null, isAuthenticated: false })
  },
  updateUser: (user) => {
    localStorage.setItem('qm_user', JSON.stringify(user))
    set({ user })
  }
}))
