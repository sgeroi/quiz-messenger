import React, { useEffect, useState } from 'react'
import { api } from '../api'

interface Contact {
  id: string
  nickname: string
  displayName: string
  avatarColor: string
}

interface Props {
  onBack: () => void
  onStartDirect: (userId: string) => void
  onCreateGroup: (name: string, memberIds: string[]) => void
}

export default function NewChatScreen({ onBack, onStartDirect, onCreateGroup }: Props) {
  const [mode, setMode] = useState<'select' | 'group'>('select')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [groupName, setGroupName] = useState('')

  useEffect(() => {
    api.getContacts().then(setContacts).catch(console.error)
  }, [])

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }} className="animate-slideIn">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)'
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: 'var(--accent)',
          fontSize: 24, cursor: 'pointer', padding: '4px 8px', marginLeft: -8
        }}>←</button>
        <h2 style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>
          {mode === 'select' ? 'Новый чат' : 'Новая группа'}
        </h2>
      </div>

      {mode === 'select' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Create group button */}
          <div
            onClick={() => setMode('group')}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border)'
            }}
          >
            <div className="avatar" style={{ background: 'var(--accent)' }}>👥</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Создать группу</div>
          </div>

          <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
            Контакты
          </div>

          {contacts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>Нет контактов</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Добавь кого-нибудь во вкладке Контакты</p>
            </div>
          ) : (
            contacts.map(c => (
              <div
                key={c.id}
                onClick={() => onStartDirect(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border)'
                }}
              >
                <div className="avatar" style={{ background: c.avatarColor }}>
                  {c.displayName[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.displayName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{c.nickname}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {mode === 'group' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px' }}>
            <input
              className="input"
              placeholder="Название группы"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>
              Выбери участников ({selectedIds.size})
            </p>
          </div>

          {contacts.map(c => (
            <div
              key={c.id}
              onClick={() => toggleSelect(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: selectedIds.has(c.id) ? 'rgba(168,85,247,0.08)' : ''
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: 8,
                border: `2px solid ${selectedIds.has(c.id) ? 'var(--accent)' : 'var(--border)'}`,
                background: selectedIds.has(c.id) ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 14, fontWeight: 700
              }}>
                {selectedIds.has(c.id) ? '✓' : ''}
              </div>
              <div className="avatar avatar-sm" style={{ background: c.avatarColor }}>
                {c.displayName[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.displayName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{c.nickname}</div>
              </div>
            </div>
          ))}

          <div style={{ padding: '16px 20px' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (groupName.trim() && selectedIds.size > 0) {
                  onCreateGroup(groupName.trim(), [...selectedIds])
                }
              }}
              disabled={!groupName.trim() || selectedIds.size === 0}
              style={{ width: '100%' }}
            >
              Создать группу ({selectedIds.size})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
