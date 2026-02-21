'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import { auth } from './firebase'
import { createUserProfile, getUserProfile } from './db'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const profile = await getUserProfile(firebaseUser.uid)
          setUser(firebaseUser)
          setUserProfile(profile)
        } else {
          setUser(null)
          setUserProfile(null)
        }
      } catch (error) {
        console.error("Erro ao carregar perfil:", error)
      } finally {
        setLoading(false)
      }
    })

    return unsub
  }, [])

  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const profile = await getUserProfile(result.user.uid)
      setUserProfile(profile)
      return result
    } catch (error) {
      console.error("Erro no login:", error)
      throw error
    }
  }

  const register = async (email, password, nome) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)

      await createUserProfile(result.user.uid, {
        nome,
        email,
        role: 'user'
      })

      const profile = await getUserProfile(result.user.uid)
      setUserProfile(profile)

      return result

    } catch (error) {
      console.error("Erro ao registrar usuário:", error)
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Erro ao sair:", error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)