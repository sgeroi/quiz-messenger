import React, { useEffect, useState } from 'react'
import { useAuthStore } from './stores/authStore'
import { useChatStore } from './stores/chatStore'
import { connectSocket, disconnectSocket, getSocket } from './socket'
import { api } from './api'
import AuthScreen from './screens/AuthScreen'
import ChatsScreen from './screens/ChatsScreen'
import ChatRoom from './screens/ChatRoom'
import ContactsScreen from './screens/ContactsScreen'
import ProfileScreen from './screens/ProfileScreen'
import NewChatScreen from './screens/NewChatScreen'

type Screen = 'chats' | 'chat' | 'contacts' | 'profile' | 'new-chat'
type Tab = 'chats' | 'contacts' | 'profile'

export default function App() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const token = useAuthStore(s => s.token)
  const user = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)
  const addMessage = useChatStore(s => s.addMessage)
  const updateChatLastMessage = useChatStore(s => s.updateChatLastMessage)
  const addChat = useChatStore(s => s.addChat)

  const [screen, setScreen] = useState<Screen>('chats')
  const [activeTab, setActiveTab] = useState<Tab>('chats')
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token) return

    const socket = connectSocket(token)

    // Listen for new messages
    socket.on('message:new', (msg) => {
      addMessage(msg)
      updateChatLastMessage(msg.chatId, msg.content, msg.createdAt, msg.senderId)
    })

    // Refresh user profile
    api.getMe().then(updateUser).catch(console.error)

    return () => {
      disconnectSocket()
    }
  }, [isAuthenticated, token])

  if (!isAuthenticated) {
    return <AuthScreen />
  }

  const openChat = (chatId: string) => {
    setActiveChatId(chatId)
    setScreen('chat')
  }

  const handleStartDirect = async (userId: string) => {
    try {
      const chat = await api.createDirectChat(userId)
      addChat(chat)
      getSocket()?.emit('chat:join', { chatId: chat.id })
      openChat(chat.id)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    try {
      const chat = await api.createGroupChat(name, memberIds)
      addChat(chat)
      getSocket()?.emit('chat:join', { chatId: chat.id })
      openChat(chat.id)
    } catch (err) {
      console.error(err)
    }
  }

  const goBack = () => {
    setScreen('chats')
    setActiveChatId(null)
  }

  const switchTab = (tab: Tab) => {
    setActiveTab(tab)
    setScreen(tab)
  }

  // Render current screen
  const renderScreen = () => {
    if (screen === 'chat' && activeChatId) {
      return <ChatRoom chatId={activeChatId} onBack={goBack} />
    }

    if (screen === 'new-chat') {
      return (
        <NewChatScreen
          onBack={() => setScreen('chats')}
          onStartDirect={handleStartDirect}
          onCreateGroup={handleCreateGroup}
        />
      )
    }

    return (
      <>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeTab === 'chats' && (
            <ChatsScreen
              onOpenChat={openChat}
              onNewChat={() => setScreen('new-chat')}
            />
          )}
          {activeTab === 'contacts' && (
            <ContactsScreen onStartChat={handleStartDirect} />
          )}
          {activeTab === 'profile' && <ProfileScreen />}
        </div>

        {/* Tab Bar */}
        <div className="tab-bar">
          <button
            className={`tab-item ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => switchTab('chats')}
          >
            <span className="tab-icon">💬</span>
            <span>Чаты</span>
          </button>
          <button
            className={`tab-item ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => switchTab('contacts')}
          >
            <span className="tab-icon">👤</span>
            <span>Контакты</span>
          </button>
          <button
            className={`tab-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => switchTab('profile')}
          >
            <span className="tab-icon">🧠</span>
            <span>Профиль</span>
          </button>
        </div>
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
      {renderScreen()}
    </div>
  )
}
