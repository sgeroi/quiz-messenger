const BASE = '/api'

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('qm_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  register: (nickname: string, displayName: string, password: string) =>
    request('/register', { method: 'POST', body: JSON.stringify({ nickname, displayName, password }) }),

  login: (nickname: string, password: string) =>
    request('/login', { method: 'POST', body: JSON.stringify({ nickname, password }) }),

  verifyQuiz: (quizToken: string, answer: number) =>
    request('/login/verify', { method: 'POST', body: JSON.stringify({ quizToken, answer }) }),

  getMe: () => request('/me'),

  getAllUsers: () => request('/users'),
  getUserProfile: (userId: string) => request(`/users/${userId}`),
  searchUsers: (q: string) => request(`/users/search?q=${encodeURIComponent(q)}`),

  getContacts: () => request('/contacts'),

  addContact: (userId: string) =>
    request('/contacts', { method: 'POST', body: JSON.stringify({ userId }) }),

  getChats: () => request('/chats'),

  createDirectChat: (userId: string) =>
    request('/chats/direct', { method: 'POST', body: JSON.stringify({ userId }) }),

  createGroupChat: (name: string, memberIds: string[]) =>
    request('/chats/group', { method: 'POST', body: JSON.stringify({ name, memberIds }) }),

  getMessages: (chatId: string) => request(`/chats/${chatId}/messages`),

  uploadAvatar: async (file: File) => {
    const token = localStorage.getItem('qm_token')
    const form = new FormData()
    form.append('avatar', file)
    const res = await fetch(`${BASE}/me/avatar`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data
  },
}
