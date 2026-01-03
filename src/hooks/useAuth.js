import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useAuth() {
    const [session, setSession] = useState(null)
    const [authEmail, setAuthEmail] = useState('')
    const [authPassword, setAuthPassword] = useState('')
    const [authLoading, setAuthLoading] = useState(false)

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [])

    const handleLogin = async () => {
        setAuthLoading(true)
        const { error } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: authPassword
        })
        if (error) alert(error.message)
        setAuthLoading(false)
    }

    const handleSignUp = async () => {
        setAuthLoading(true)
        const { error } = await supabase.auth.signUp({
            email: authEmail,
            password: authPassword
        })
        if (error) alert(error.message)
        else alert('Проверьте почту для подтверждения регистрации!')
        setAuthLoading(false)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setAuthEmail('')
        setAuthPassword('')
    }

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { queryParams: { access_type: 'offline', prompt: 'consent' } }
        })
        if (error) alert(error.message)
    }

    return {
        session,
        user: session?.user ?? null,
        authEmail, setAuthEmail,
        authPassword, setAuthPassword,
        authLoading,
        handleLogin,
        handleSignUp,
        handleLogout,
        handleGoogleLogin
    }
}
