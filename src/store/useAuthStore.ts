import { create } from 'zustand'
import { supabase } from '../supabase'
import { useUIStore } from './useUIStore'
import { Session } from '@supabase/supabase-js'

interface AuthStore {
    session: Session | null
    user: Session['user'] | null
    loading: boolean
    authEmail: string
    authPassword: string

    setAuthEmail: (email: string) => void
    setAuthPassword: (password: string) => void

    initSession: () => Promise<() => void>
    login: () => Promise<void>
    signUp: () => Promise<void>
    logout: () => Promise<void>
    loginWithGoogle: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
    session: null,
    user: null,
    loading: true,
    authEmail: '',
    authPassword: '',

    setAuthEmail: (email) => set({ authEmail: email }),
    setAuthPassword: (password) => set({ authPassword: password }),

    initSession: async () => {
        set({ loading: true })
        try {
            const { data: { session } } = await supabase.auth.getSession()
            // @ts-ignore: Supabase session type might mismatch slightly with our simplistic UserSession, casting for now or ignoring if convenient
            // Ideally we use Supabase types, but we are using manual types for now as requested.
            // Let's assume compatible enough or cast.
            set({ session: session, user: session?.user ?? null })

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                set({ session: session, user: session?.user ?? null, loading: false })
            })
            return () => subscription.unsubscribe()
        } catch (error) {
            console.error('Session init error:', error)
            useUIStore.getState().showToast('Ошибка инициализации сессии', 'error')
            return () => { }
        } finally {
            set({ loading: false })
        }
    },

    login: async () => {
        set({ loading: true })
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: get().authEmail,
                password: get().authPassword
            })
            if (error) throw error
            useUIStore.getState().showToast('Успешный вход', 'success')
        } catch (error: any) {
            useUIStore.getState().showToast(error.message, 'error')
        } finally {
            set({ loading: false })
        }
    },

    signUp: async () => {
        set({ loading: true })
        try {
            const { error } = await supabase.auth.signUp({
                email: get().authEmail,
                password: get().authPassword
            })
            if (error) throw error
            useUIStore.getState().showToast('Проверьте почту для подтверждения!', 'info')
        } catch (error: any) {
            useUIStore.getState().showToast(error.message, 'error')
        } finally {
            set({ loading: false })
        }
    },

    logout: async () => {
        set({ loading: true })
        try {
            await supabase.auth.signOut()
            set({ session: null, user: null })
            useUIStore.getState().showToast('Вы вышли из системы', 'info')
        } catch (error: any) {
            console.error('Logout error:', error)
            useUIStore.getState().showToast('Ошибка выхода', 'error')
        } finally {
            set({ loading: false })
        }
    },

    loginWithGoogle: async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    queryParams: { access_type: 'offline', prompt: 'consent' },
                    redirectTo: window.location.origin
                }
            })
            if (error) throw error
        } catch (error: any) {
            useUIStore.getState().showToast(error.message, 'error')
        }
    }
}))
