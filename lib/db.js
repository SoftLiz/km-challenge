// lib/db.js
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'

// ─── USERS ───────────────────────────────────────────────────────────────────

export async function createUserProfile(uid, { nome, email, role = 'user' }) {
  await setDoc(doc(db, 'users', uid), {
    nome, email, role,
    created_at: serverTimestamp()
  })
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// ─── CHALLENGES ──────────────────────────────────────────────────────────────

export async function getActiveChallenge() {
  const q = query(collection(db, 'challenges'), where('status', '==', 'ativo'))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const doc_ = snap.docs[0]
  return { id: doc_.id, ...doc_.data() }
}

export async function createChallenge({ nome, descricao, meta_km, data_inicio, data_fim, created_by }) {
  const ref = await addDoc(collection(db, 'challenges'), {
    nome, descricao, meta_km, data_inicio, data_fim,
    status: 'ativo', created_by,
    created_at: serverTimestamp()
  })
  return ref.id
}

export async function updateChallenge(id, data) {
  await updateDoc(doc(db, 'challenges', id), data)
}

// ─── PARTICIPANTS ─────────────────────────────────────────────────────────────

export async function joinChallenge(challenge_id, user_id) {
  // Verifica se já é participante
  const q = query(
    collection(db, 'participants'),
    where('challenge_id', '==', challenge_id),
    where('user_id', '==', user_id)
  )
  const snap = await getDocs(q)
  if (!snap.empty) return // Já é participante

  await addDoc(collection(db, 'participants'), {
    challenge_id, user_id,
    joined_at: serverTimestamp()
  })
}

export async function getParticipants(challenge_id) {
  const q = query(collection(db, 'participants'), where('challenge_id', '==', challenge_id))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function removeParticipant(challenge_id, user_id) {
  const q = query(
    collection(db, 'participants'),
    where('challenge_id', '==', challenge_id),
    where('user_id', '==', user_id)
  )
  const snap = await getDocs(q)
  snap.docs.forEach(d => deleteDoc(d.ref))
}

// ─── ENTRIES ─────────────────────────────────────────────────────────────────

export async function addEntry({ challenge_id, user_id, data, km, observacao = '' }) {
  const ref = await addDoc(collection(db, 'entries'), {
    challenge_id, user_id, data, km, observacao,
    created_at: serverTimestamp()
  })
  return ref.id
}

export async function deleteEntry(entry_id) {
  await deleteDoc(doc(db, 'entries', entry_id))
}

export async function getEntriesForChallenge(challenge_id) {
  const q = query(
    collection(db, 'entries'),
    where('challenge_id', '==', challenge_id),
    orderBy('data', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── REALTIME LISTENERS ───────────────────────────────────────────────────────

export function listenToEntries(challenge_id, callback) {
  const q = query(
    collection(db, 'entries'),
    where('challenge_id', '==', challenge_id)
  )
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(entries)
  })
}

export function listenToParticipants(challenge_id, callback) {
  const q = query(collection(db, 'participants'), where('challenge_id', '==', challenge_id))
  return onSnapshot(q, (snap) => {
    const participants = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(participants)
  })
}

// ─── GET ALL USERS (para ranking) ────────────────────────────────────────────

export async function getAllUsers(userIds) {
  const promises = userIds.map(uid => getDoc(doc(db, 'users', uid)))
  const snaps = await Promise.all(promises)
  return snaps
    .filter(s => s.exists())
    .map(s => ({ id: s.id, ...s.data() }))
}
