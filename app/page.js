'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import {
  getActiveChallenge, joinChallenge, getParticipants, getAllUsers,
  addEntry, deleteEntry, listenToEntries, listenToParticipants,
  updateChallenge, removeParticipant, createChallenge
} from '../lib/db'

// ─── UTILS ────────────────────────────────────────────────────────────────────

const today = new Date()
const fmt = (d) => d instanceof Date ? d.toISOString().split('T')[0] : d

const calcMetrics = (userId, entries, challenge) => {
  const userEntries = entries.filter(e => e.user_id === userId && e.challenge_id === challenge.id)
  const total = userEntries.reduce((s, e) => s + (e.km || 0), 0)
  const meta = challenge.meta_km || 120

  // ─── CÁLCULO DE DIAS – versão limpa e segura ───────────────────────────────
  const start     = new Date(challenge.data_inicio)
  const end       = new Date(challenge.data_fim)
  const todayDate = new Date(fmt(new Date()))   // apenas a data de hoje (meia-noite)

  const totalDays    = Math.floor((end - start) / 86400000) + 1
  const rawElapsed   = Math.floor((todayDate - start) / 86400000) + 1
  const elapsedDays  = Math.min(Math.max(rawElapsed, 1), totalDays)
  const remainingDays = Math.max(totalDays - elapsedDays, 0)
  // ────────────────────────────────────────────────────────────────────────────

  const pct = Math.min((total / meta) * 100, 100)
  const daysWithActivity = new Set(userEntries.map(e => e.data)).size
  const regularidade = elapsedDays > 0 ? (daysWithActivity / elapsedDays) * 100 : 0
  const mediaReal    = elapsedDays > 0 ? total / elapsedDays : 0
  const metaIdeal    = remainingDays > 0 ? (meta - total) / remainingDays : 0
  const ritmoEsperado = elapsedDays > 0 ? (meta / totalDays) * elapsedDays : 0
  const ritmo = total >= ritmoEsperado ? 'ahead' : 'behind'

  return {
    total,
    meta,
    pct,
    totalDays,
    elapsedDays,
    remainingDays,
    regularidade,
    mediaReal,
    metaIdeal,
    ritmo,
    daysWithActivity
  }
}

const avatarColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD', '#98D8C8']
const getAvatarColor = (uid) => avatarColors[uid?.charCodeAt(uid.length - 1) % avatarColors.length] || '#00F5A0'
const getInitials = (nome) => nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────

function Avatar({ nome, userId, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${getAvatarColor(userId)}, ${getAvatarColor(userId)}99)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', cursive", fontSize: size * 0.36, color: '#fff',
      flexShrink: 0, border: '2px solid rgba(255,255,255,0.15)',
    }}>
      {getInitials(nome)}
    </div>
  )
}

function ProgressBar({ pct, color = '#00F5A0', height = 8 }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 99, width: `${Math.min(pct, 100)}%`,
        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
        transition: 'width 1s cubic-bezier(.4,0,.2,1)',
        boxShadow: `0 0 8px ${color}66`,
      }} />
    </div>
  )
}

function CircularProgress({ pct, size = 100, color = '#00F5A0' }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * (Math.min(pct, 100) / 100)
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }} />
    </svg>
  )
}

function Modal({ children, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: '#0F0F1A', borderRadius: '24px 24px 0 0', padding: '32px 24px 48px',
        width: '100%', maxWidth: 480, border: '1px solid rgba(255,255,255,0.1)',
        borderBottom: 'none', maxHeight: '90vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff',
  fontFamily: "'DM Sans', sans-serif", fontSize: 15, outline: 'none', boxSizing: 'border-box',
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────

function LoginPage() {
  const { login, register } = useAuth()
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { setError('Preenche todos os campos.'); return }
    setLoading(true)
    try {
      await login(email, password)
    } catch (e) {
      setError('Email ou senha incorretos.')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    if (!nome || !email || !password) { setError('Preenche todos os campos.'); return }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true)
    try {
      await register(email, password, nome)
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setError('Email já em uso.')
      else setError('Erro ao criar conta.')
    }
    setLoading(false)
  }

  const btnStyle = {
    width: '100%', padding: '16px', background: loading ? 'rgba(0,245,160,0.3)' : 'linear-gradient(135deg, #00F5A0, #00D9F5)',
    border: 'none', borderRadius: 12, color: '#0A0A15', fontFamily: "'Bebas Neue', cursive",
    fontSize: 18, letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A15', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, background: 'radial-gradient(circle, #00F5A044, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🏃‍♂️</div>
        <h1 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 52, color: '#fff', margin: 0, letterSpacing: 4 }}>MOVE</h1>
        <h1 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 52, background: 'linear-gradient(135deg, #00F5A0, #00D9F5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '-10px 0 0', letterSpacing: 4 }}>CHALLENGE</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 8, letterSpacing: 2 }}>DESAFIOS DE ATIVIDADE FÍSICA</p>
      </div>

      <div style={{ width: '100%', maxWidth: 400, background: 'rgba(255,255,255,0.04)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', padding: 28 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4 }}>
          {['login', 'register'].map(t => (
            <button key={t} onClick={() => { setTab(t); setError('') }} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t ? 'rgba(0,245,160,0.15)' : 'transparent',
              color: tab === t ? '#00F5A0' : 'rgba(255,255,255,0.4)',
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
            }}>{t === 'login' ? 'Entrar' : 'Criar Conta'}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'register' && (
            <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Teu nome público" />
          )}
          <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" />
          <input style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha (mín. 6 caracteres)" type="password"
            onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleRegister())} />
          {error && <p style={{ color: '#FF6B6B', fontSize: 13, margin: 0 }}>{error}</p>}
          <button style={btnStyle} onClick={tab === 'login' ? handleLogin : handleRegister} disabled={loading}>
            {loading ? 'A carregar...' : tab === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── NO CHALLENGE PAGE ────────────────────────────────────────────────────────

function NoChallengePage({ userProfile, onChallengeCreated }) {
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    nome: '', descricao: '', meta_km: 120,
    data_inicio: fmt(today), data_fim: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0))
  })
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!form.nome) return
    setLoading(true)
    try {
      const id = await createChallenge({ ...form, created_by: userProfile.id })
      onChallengeCreated()
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>🏁</div>
      <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 28, color: '#fff', marginBottom: 8 }}>SEM DESAFIO ATIVO</h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, maxWidth: 280, marginBottom: 32 }}>
        {userProfile?.role === 'master' ? 'Cria um novo desafio para o grupo começar!' : 'Aguarda o Master criar um novo desafio.'}
      </p>
      {userProfile?.role === 'master' && (
        <button onClick={() => setShowCreate(true)} style={{
          padding: '16px 32px', background: 'linear-gradient(135deg, #00F5A0, #00D9F5)',
          border: 'none', borderRadius: 14, color: '#0A0A15', fontFamily: "'Bebas Neue', cursive",
          fontSize: 18, letterSpacing: 2, cursor: 'pointer'
        }}>CRIAR DESAFIO</button>
      )}

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <h3 style={{ color: '#fff', fontFamily: "'Bebas Neue', cursive", fontSize: 28, margin: '0 0 20px', letterSpacing: 2 }}>NOVO DESAFIO</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input style={inputStyle} value={form.nome} onChange={e => setForm(p => ({...p, nome: e.target.value}))} placeholder="Nome do desafio (ex: Desafio Março 🔥)" />
            <input style={inputStyle} value={form.descricao} onChange={e => setForm(p => ({...p, descricao: e.target.value}))} placeholder="Descrição" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, display: 'block', marginBottom: 4 }}>INÍCIO</label>
                <input style={inputStyle} type="date" value={form.data_inicio} onChange={e => setForm(p => ({...p, data_inicio: e.target.value}))} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, display: 'block', marginBottom: 4 }}>FIM</label>
                <input style={inputStyle} type="date" value={form.data_fim} onChange={e => setForm(p => ({...p, data_fim: e.target.value}))} />
              </div>
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, display: 'block', marginBottom: 4 }}>META (KM)</label>
              <input style={inputStyle} type="number" value={form.meta_km} onChange={e => setForm(p => ({...p, meta_km: Number(e.target.value)}))} />
            </div>
            <button onClick={handleCreate} disabled={loading} style={{
              padding: '16px', background: 'linear-gradient(135deg, #00F5A0, #00D9F5)',
              border: 'none', borderRadius: 12, color: '#0A0A15', fontFamily: "'Bebas Neue', cursive",
              fontSize: 18, letterSpacing: 2, cursor: 'pointer', marginTop: 8
            }}>{loading ? 'A criar...' : 'CRIAR DESAFIO'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────

function DashboardPage({ userProfile, challenge, entries }) {
  const m = calcMetrics(userProfile.id, entries, challenge)
  const todayStr = fmt(today)
  const recentEntries = entries.filter(e => e.user_id === userProfile.id).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 7)
  const ritmoInfo = m.ritmo === 'ahead' ? { label: 'Acima da meta 🔥', color: '#00F5A0' } : { label: 'Abaixo da meta ⚠️', color: '#FFB347' }

  return (
    <div style={{ padding: '0 0 100px' }}>
      {/* Hero */}
      <div style={{ margin: '0 16px 20px', padding: '28px 24px', borderRadius: 24, background: 'linear-gradient(135deg, #0D2E1E 0%, #0A1628 100%)', border: '1px solid rgba(0,245,160,0.2)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, #00F5A022, transparent 70%)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '0 0 4px', letterSpacing: 1 }}>MEU PROGRESSO</p>
            <h2 style={{ color: '#fff', fontFamily: "'Bebas Neue', cursive", fontSize: 42, margin: 0, letterSpacing: 2 }}>
              {m.total.toFixed(1)} <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)' }}>KM</span>
            </h2>
            <p style={{ color: '#00F5A0', fontSize: 13, margin: '4px 0 0', fontWeight: 600 }}>{m.pct.toFixed(1)}% da meta {challenge.meta_km}km</p>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress pct={m.pct} size={100} color="#00F5A0" />
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, color: '#fff' }}>{Math.round(m.pct)}%</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <ProgressBar pct={m.pct} color="#00F5A0" height={6} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 20 }}>
          {[
            { label: 'Restam', value: `${Math.max(m.meta - m.total, 0).toFixed(1)}km` },
            { label: 'Dias restantes', value: `${m.remainingDays}d` },
            { label: 'Meta diária', value: `${m.metaIdeal.toFixed(1)}km` },
          ].map(item => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ color: '#00F5A0', fontFamily: "'Bebas Neue', cursive", fontSize: 18 }}>{item.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '0 16px 20px' }}>
        {[
          { icon: '📊', label: 'MÉDIA DIÁRIA', value: `${m.mediaReal.toFixed(1)}`, unit: 'KM' },
          { icon: '📅', label: 'REGULARIDADE', value: `${m.regularidade.toFixed(0)}`, unit: '%' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: '18px 16px', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1 }}>{s.label}</div>
            <div style={{ color: '#fff', fontFamily: "'Bebas Neue', cursive", fontSize: 28, marginTop: 4 }}>
              {s.value} <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Ritmo */}
      <div style={{ margin: '0 16px 20px', padding: '14px 18px', borderRadius: 14, background: `${ritmoInfo.color}15`, border: `1px solid ${ritmoInfo.color}33`, display: 'flex', alignItems: 'center' }}>
        <div style={{ color: ritmoInfo.color, fontWeight: 700, fontSize: 14 }}>{ritmoInfo.label}</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginLeft: 'auto' }}>{m.mediaReal.toFixed(1)}km/dia real</div>
      </div>

      {/* Atividade Recente */}
      <div style={{ margin: '0 16px' }}>
        <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, margin: '0 0 12px' }}>ATIVIDADE RECENTE</h3>
        {recentEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏃</div>
            <p style={{ fontSize: 14 }}>Sem atividades ainda. Adiciona os teus km!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentEntries.map(e => (
              <div key={e.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                    {e.data === todayStr ? '🔥 Hoje' : new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  {e.observacao && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{e.observacao}</div>}
                </div>
                <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 24, color: '#00F5A0' }}>{e.km}<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>km</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── RANKING PAGE ─────────────────────────────────────────────────────────────

function RankingPage({ challenge, entries, participants, usersMap, currentUserId }) {
  const ranking = Object.values(usersMap)
    .filter(u => participants.some(p => p.user_id === u.id))
    .map(u => ({ user: u, ...calcMetrics(u.id, entries, challenge) }))
    .sort((a, b) => b.total - a.total)

  const medals = ['🥇', '🥈', '🥉']
  const posColors = ['#FFD700', '#C0C0C0', '#CD7F32']

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#fff', fontFamily: "'Bebas Neue', cursive", fontSize: 32, margin: '0 0 4px', letterSpacing: 3 }}>RANKING</h2>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>{challenge.nome}</p>
      </div>

      {ranking.length >= 3 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {[ranking[1], ranking[0], ranking[2]].map((r, i) => {
            const actualPos = i === 1 ? 0 : i === 0 ? 1 : 2
            const heights = [100, 130, 85]
            return (
              <div key={r.user.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <Avatar nome={r.user.nome} userId={r.user.id} size={actualPos === 0 ? 52 : 40} />
                <div style={{ marginTop: 6, color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.user.nome?.split(' ')[0]}</div>
                <div style={{ color: '#00F5A0', fontFamily: "'Bebas Neue', cursive", fontSize: 15 }}>{r.total.toFixed(1)}km</div>
                <div style={{ width: '100%', height: heights[i], marginTop: 8, borderRadius: '8px 8px 0 0', background: `linear-gradient(to top, ${posColors[actualPos]}22, ${posColors[actualPos]}44)`, border: `1px solid ${posColors[actualPos]}44`, borderBottom: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 12, fontSize: actualPos === 0 ? 28 : 22 }}>
                  {medals[actualPos]}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ranking.map((r, i) => {
          const isMe = r.user.id === currentUserId
          return (
            <div key={r.user.id} style={{ background: isMe ? 'rgba(0,245,160,0.08)' : 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '16px', border: isMe ? '1px solid rgba(0,245,160,0.25)' : '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ color: i < 3 ? posColors[i] : 'rgba(255,255,255,0.25)', fontFamily: "'Bebas Neue', cursive", fontSize: 20, width: 28, textAlign: 'center' }}>
                  {i < 3 ? medals[i] : `#${i + 1}`}
                </div>
                <Avatar nome={r.user.nome} userId={r.user.id} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                      {r.user.nome}{isMe && <span style={{ color: '#00F5A0', fontSize: 11, marginLeft: 6 }}>• tu</span>}
                    </span>
                    <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20, color: '#00F5A0' }}>{r.total.toFixed(1)}<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>km</span></span>
                  </div>
                  <ProgressBar pct={r.pct} color={i === 0 ? '#FFD700' : '#00F5A0'} height={5} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{r.pct.toFixed(1)}% da meta</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{r.regularidade.toFixed(0)}% regular</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

function HistoryPage({ userProfile, challenge, entries, onDelete }) {
  const userEntries = entries.filter(e => e.user_id === userProfile.id && e.challenge_id === challenge.id).sort((a, b) => b.data.localeCompare(a.data))
  const weeklyTotals = {}
  userEntries.forEach(e => {
    const d = new Date(e.data + 'T12:00:00')
    const ws = new Date(d); ws.setDate(d.getDate() - d.getDay() + 1)
    const wk = fmt(ws)
    weeklyTotals[wk] = (weeklyTotals[wk] || 0) + e.km
  })
  const getWeek = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00'); const ws = new Date(d); ws.setDate(d.getDate() - d.getDay() + 1); return fmt(ws)
  }
  let lastWeek = null

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#fff', fontFamily: "'Bebas Neue', cursive", fontSize: 32, margin: '0 0 4px', letterSpacing: 3 }}>HISTÓRICO</h2>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>{userEntries.length} atividades registadas</p>
      </div>
      {userEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏃</div>
          <p>Sem atividades ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {userEntries.map(e => {
            const wk = getWeek(e.data)
            const showHeader = wk !== lastWeek
            lastWeek = wk
            return (
              <div key={e.id}>
                {showHeader && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 4px 6px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 1.5 }}>SEMANA DE {new Date(wk + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).toUpperCase()}</span>
                    <span style={{ color: '#00F5A0', fontFamily: "'Bebas Neue', cursive", fontSize: 16 }}>{weeklyTotals[wk].toFixed(1)}km</span>
                  </div>
                )}
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'rgba(0,245,160,0.1)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', minWidth: 52 }}>
                    <div style={{ color: '#00F5A0', fontFamily: "'Bebas Neue', cursive", fontSize: 22 }}>{e.km}</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>KM</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>
                      {new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    {e.observacao && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{e.observacao}</div>}
                  </div>
                  <button onClick={() => onDelete(e.id)} style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 8, padding: '8px 10px', color: '#FF6B6B', cursor: 'pointer', fontSize: 16 }}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────

function AdminPage({ challenge, participants, usersMap, onUpdateChallenge, onRemoveParticipant }) {
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ ...challenge })
  const [loading, setLoading] = useState(false)

  const participantUsers = participants.map(p => usersMap[p.user_id]).filter(Boolean)

  const handleSave = async () => {
    setLoading(true)
    try { await onUpdateChallenge(form); setEditMode(false) }
    catch (e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: '#fff', fontFamily: "'Bebas Neue', cursive", fontSize: 32, margin: '0 0 4px', letterSpacing: 3 }}>ADMIN</h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>Painel do Master</p>
        </div>
        <div style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 20, padding: '4px 12px', color: '#FFD700', fontSize: 12, fontWeight: 700 }}>👑 MASTER</div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 20, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#fff', fontFamily: "'Bebas Neue', cursive", fontSize: 20, margin: 0 }}>DESAFIO ATIVO</h3>
          <button onClick={() => setEditMode(!editMode)} style={{ background: 'rgba(0,245,160,0.1)', border: '1px solid rgba(0,245,160,0.3)', borderRadius: 8, padding: '6px 14px', color: '#00F5A0', cursor: 'pointer', fontSize: 13 }}>{editMode ? 'Cancelar' : '✏️ Editar'}</button>
        </div>
        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input style={inputStyle} value={form.nome} onChange={e => setForm(p => ({...p, nome: e.target.value}))} placeholder="Nome do desafio" />
            <input style={inputStyle} value={form.descricao} onChange={e => setForm(p => ({...p, descricao: e.target.value}))} placeholder="Descrição" />
            <input style={inputStyle} type="number" value={form.meta_km} onChange={e => setForm(p => ({...p, meta_km: Number(e.target.value)}))} placeholder="Meta (km)" />
            <input style={inputStyle} type="date" value={form.data_inicio} onChange={e => setForm(p => ({...p, data_inicio: e.target.value}))} />
            <input style={inputStyle} type="date" value={form.data_fim} onChange={e => setForm(p => ({...p, data_fim: e.target.value}))} />
            <button onClick={handleSave} disabled={loading} style={{ padding: '12px', background: 'linear-gradient(135deg, #00F5A0, #00D9F5)', border: 'none', borderRadius: 10, color: '#0A0A15', fontFamily: "'Bebas Neue', cursive", fontSize: 16, letterSpacing: 2, cursor: 'pointer' }}>
              {loading ? 'A guardar...' : 'GUARDAR'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['Nome', challenge.nome], ['Meta', `${challenge.meta_km} km`], ['Início', challenge.data_inicio], ['Fim', challenge.data_fim], ['Status', challenge.status]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{k}</span>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 style={{ color: '#fff', fontFamily: "'Bebas Neue', cursive", fontSize: 20, margin: '0 0 16px' }}>PARTICIPANTES ({participantUsers.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {participantUsers.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Avatar nome={u.nome} userId={u.id} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: 14 }}>{u.nome}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{u.email}</div>
              </div>
              {u.role === 'master' ? (
                <span style={{ color: '#FFD700', fontSize: 16 }}>👑</span>
              ) : (
                <button onClick={() => onRemoveParticipant(u.id)} style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 8, padding: '6px 10px', color: '#FF6B6B', cursor: 'pointer', fontSize: 12 }}>Remover</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── ADD KM MODAL ─────────────────────────────────────────────────────────────

function AddKmModal({ challenge, onClose, onSave }) {
  const [km, setKm] = useState('')
  const [date, setDate] = useState(fmt(today))
  const [obs, setObs] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    const kmNum = parseFloat(km)
    if (!km || isNaN(kmNum) || kmNum <= 0) { setError('Insere um valor válido.'); return }
    if (date < challenge.data_inicio || date > challenge.data_fim) { setError('Data fora do intervalo do desafio.'); return }
    if (date > fmt(today)) { setError('Não podes lançar datas futuras.'); return }
    setLoading(true)
    try { await onSave({ km: kmNum, data: date, observacao: obs }); onClose() }
    catch (e) { setError('Erro ao guardar.') }
    setLoading(false)
  }

  return (
    <Modal onClose={onClose}>
      <h3 style={{ color: '#fff', fontFamily: "'Bebas Neue', cursive", fontSize: 28, margin: '0 0 6px', letterSpacing: 2 }}>ADICIONAR KM</h3>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: '0 0 24px' }}>Regista a tua atividade</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1, display: 'block', marginBottom: 6 }}>DATA</label>
          <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} min={challenge.data_inicio} max={fmt(today)} />
        </div>
        <div>
          <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1, display: 'block', marginBottom: 6 }}>QUILÓMETROS</label>
          <input style={{ ...inputStyle, fontSize: 32, fontFamily: "'Bebas Neue', cursive", textAlign: 'center', letterSpacing: 2 }} type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="0.0" min="0" step="0.1" />
        </div>
        <div>
          <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1, display: 'block', marginBottom: 6 }}>OBSERVAÇÃO (OPCIONAL)</label>
          <input style={inputStyle} value={obs} onChange={e => setObs(e.target.value)} placeholder="ex: corrida matinal, caminhada..." />
        </div>
        {error && <p style={{ color: '#FF6B6B', fontSize: 13, margin: 0 }}>{error}</p>}
        <button onClick={handleSave} disabled={loading} style={{ padding: '16px', background: loading ? 'rgba(0,245,160,0.3)' : 'linear-gradient(135deg, #00F5A0, #00D9F5)', border: 'none', borderRadius: 12, color: '#0A0A15', fontFamily: "'Bebas Neue', cursive", fontSize: 20, letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8 }}>
          {loading ? 'A guardar...' : 'GUARDAR'}
        </button>
      </div>
    </Modal>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, userProfile, loading, logout } = useAuth()
  const [challenge, setChallenge] = useState(null)
  const [participants, setParticipants] = useState([])
  const [entries, setEntries] = useState([])
  const [usersMap, setUsersMap] = useState({})
  const [page, setPage] = useState('dashboard')
  const [showAddKm, setShowAddKm] = useState(false)
  const [appLoading, setAppLoading] = useState(true)

  // Carrega o desafio ativo
  useEffect(() => {
    if (!userProfile) return
    let unsubEntries, unsubParticipants

    const init = async () => {
      setAppLoading(true)
      const c = await getActiveChallenge()
      if (!c) { setChallenge(null); setAppLoading(false); return }

      setChallenge(c)
      await joinChallenge(c.id, userProfile.id)

      // Listeners em tempo real
      unsubEntries = listenToEntries(c.id, setEntries)
      unsubParticipants = listenToParticipants(c.id, async (parts) => {
        setParticipants(parts)
        const uids = [...new Set(parts.map(p => p.user_id))]
        const users = await getAllUsers(uids)
        const map = {}
        users.forEach(u => { map[u.id] = u })
        setUsersMap(map)
      })

      setAppLoading(false)
    }

    init()
    return () => { unsubEntries?.(); unsubParticipants?.() }
  }, [userProfile])

  const handleAddKm = async ({ km, data, observacao }) => {
    await addEntry({ challenge_id: challenge.id, user_id: userProfile.id, km, data, observacao })
  }

  const handleDeleteEntry = async (entryId) => {
    await deleteEntry(entryId)
  }

  const handleUpdateChallenge = async (data) => {
    await updateChallenge(challenge.id, data)
    setChallenge(prev => ({ ...prev, ...data }))
  }

  const handleRemoveParticipant = async (userId) => {
    await removeParticipant(challenge.id, userId)
  }

  // ── ESTADOS DE LOADING ──
  if (loading || (user && appLoading)) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A15', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 36, background: 'linear-gradient(135deg, #00F5A0, #00D9F5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 4 }}>KM CHALLENGE</div>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(0,245,160,0.2)', borderTop: '3px solid #00F5A0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!user) return <LoginPage />
  if (!challenge) return <NoChallengePage userProfile={userProfile} onChallengeCreated={() => window.location.reload()} />

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'ranking', label: 'Ranking', icon: '🏆' },
    { id: 'history', label: 'Histórico', icon: '📜' },
    ...(userProfile?.role === 'master' ? [{ id: 'admin', label: 'Admin', icon: '👑' }] : []),
  ]

  return (
    <div style={{ background: '#0A0A15', minHeight: '100vh' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle, #00F5A008, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '-10%', width: '30vw', height: '30vw', borderRadius: '50%', background: 'radial-gradient(circle, #00D9F508, transparent 70%)' }} />
      </div>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,10,21,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 480, margin: '0 auto' }}>
          <div>
            <h1 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, background: 'linear-gradient(135deg, #00F5A0, #00D9F5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, letterSpacing: 3 }}>KM CHALLENGE</h1>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, margin: 0 }}>{challenge.nome}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar nome={userProfile?.nome || '?'} userId={userProfile?.id || 'x'} size={34} />
            <button onClick={logout} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12 }}>Sair</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: '0 auto', paddingTop: 20, position: 'relative', zIndex: 1 }}>
        {page === 'dashboard' && <DashboardPage userProfile={userProfile} challenge={challenge} entries={entries} />}
        {page === 'ranking' && <RankingPage challenge={challenge} entries={entries} participants={participants} usersMap={usersMap} currentUserId={userProfile?.id} />}
        {page === 'history' && <HistoryPage userProfile={userProfile} challenge={challenge} entries={entries} onDelete={handleDeleteEntry} />}
        {page === 'admin' && userProfile?.role === 'master' && <AdminPage challenge={challenge} participants={participants} usersMap={usersMap} onUpdateChallenge={handleUpdateChallenge} onRemoveParticipant={handleRemoveParticipant} />}
      </div>

      {/* FAB */}
      <button onClick={() => setShowAddKm(true)} style={{
        position: 'fixed', bottom: 90, right: 'max(20px, calc(50% - 220px))',
        width: 56, height: 56, borderRadius: '50%',
        background: 'linear-gradient(135deg, #00F5A0, #00D9F5)',
        border: 'none', cursor: 'pointer', fontSize: 28, fontWeight: 300,
        boxShadow: '0 4px 24px rgba(0,245,160,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        color: '#0A0A15',
      }}>+</button>

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'rgba(10,10,21,0.96)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px 0 env(safe-area-inset-bottom, 16px)', display: 'flex', zIndex: 300 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setPage(tab.id)} style={{ flex: 1, padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, color: page === tab.id ? '#00F5A0' : 'rgba(255,255,255,0.3)', fontWeight: page === tab.id ? 600 : 400 }}>{tab.label}</span>
            {page === tab.id && <div style={{ width: 16, height: 2, background: '#00F5A0', borderRadius: 1 }} />}
          </button>
        ))}
      </div>

      {/* Add KM Modal */}
      {showAddKm && <AddKmModal challenge={challenge} onClose={() => setShowAddKm(false)} onSave={handleAddKm} />}
    </div>
  )
}