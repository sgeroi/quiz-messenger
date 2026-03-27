import React, { useEffect, useState } from 'react'
import { api } from '../api'

interface Contact {
  id: string
  nickname: string
  displayName: string
  avatarColor: string
  lastSeen?: string
}

interface Props {
  onStartChat: (userId: string) => void
}

export default function ContactsScreen({ onStartChat }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Contact[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadContacts()
  }, [])

  useEffect(() => {
    if (search.length >= 2) {
      const timer = setTimeout(() => searchUsers(), 300)
      return () => clearTimeout(timer)
    } else {
      setSearchResults([])
    }
  }, [search])

  const loadContacts = async () => {
    try {
      const data = await api.getContacts()
      setContacts(data)
      setAddedIds(new Set(data.map((c: Contact) => c.id)))
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const searchUsers = async () => {
    setSearching(true)
    try {
      const data = await api.searchUsers(search)
      setSearchResults(data)
    } catch (err) {
      console.error(err)
    }
    setSearching(false)
  }

  const addContact = async (userId: string) => {
    try {
      const contact = await api.addContact(userId)
      setContacts(prev => [...prev, contact])
      setAddedIds(prev => new Set([...prev, userId]))
    } catch (err) {
      console.error(err)
    }
  }

  const renderUser = (u: Contact, showAdd = false) => (
    <div
      key={u.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)'
      }}
    >
      <div className="avatar" style={{ background: u.avatarColor }}>
        {u.displayName[0]?.toUpperCase()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{u.displayName}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{u.nickname}</div>
      </div>
      {showAdd && !addedIds.has(u.id) ? (
        <button
          className="btn btn-ghost"
          onClick={() => addContact(u.id)}
          style={{ fontSize: 13, padding: '6px 14px' }}
        >
          + Добавить
        </button>
      ) : (
        <button
          className="btn btn-ghost"
          onClick={() => onStartChat(u.id)}
          style={{ fontSize: 13, padding: '6px 14px' }}
        >
          💬
        </button>
      )}
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>Контакты</h1>
        <input
          className="input"
          placeholder="🔍 Поиск по никнейму..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoCapitalize="off"
          style={{ borderRadius: 20 }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Search results */}
        {search.length >= 2 && (
          <div>
            <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
              {searching ? 'Поиск...' : `Результаты (${searchResults.length})`}
            </div>
            {searchResults.map(u => renderUser(u, true))}
            {!searching && searchResults.length === 0 && search.length >= 2 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                Никого не найдено
              </div>
            )}
          </div>
        )}

        {/* Contacts list */}
        {!search && (
          <>
            <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
              Мои контакты ({contacts.length})
            </div>
            {contacts.length === 0 && !loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Пока нет контактов</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                  Найди людей по никнейму ↑
                </p>
              </div>
            ) : (
              contacts.map(u => renderUser(u))
            )}
          </>
        )}
      </div>
    </div>
  )
}
