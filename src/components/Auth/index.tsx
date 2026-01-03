import React from 'react'
import { useAuthStore } from '../../store/useAuthStore'

const Auth: React.FC = () => {
    const loginWithGoogle = useAuthStore(state => state.loginWithGoogle)
    const authEmail = useAuthStore(state => state.authEmail)
    const setAuthEmail = useAuthStore(state => state.setAuthEmail)
    const authPassword = useAuthStore(state => state.authPassword)
    const setAuthPassword = useAuthStore(state => state.setAuthPassword)
    const login = useAuthStore(state => state.login)
    const signUp = useAuthStore(state => state.signUp)
    const loading = useAuthStore(state => state.loading)

    return (
        <div className="fixed inset-0 z-[1000] bg-white flex flex-col items-center justify-center p-6 text-sans animate-in fade-in duration-500">
            <div className="w-full max-w-sm flex flex-col items-center">
                {/* LOGO */}
                <div className="mb-12 flex flex-col items-center gap-4">
                    <div className="w-24 h-24 flex items-center justify-center animate-in zoom-in-50 duration-700">
                        <img
                            src="/logo.png"
                            alt="Pulse Logo"
                            className="w-full h-full object-contain drop-shadow-2xl"
                        />
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900 italic">PULSE</h1>
                    <p className="text-slate-400 font-medium text-sm">Ваш личный ассистент продуктивности</p>
                </div>

                {/* GOOGLE BUTTON */}
                <button
                    onClick={loginWithGoogle}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-4 px-6 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-[0.98] mb-8"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="#FBBC05"
                            d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
                        />
                        <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                    </svg>
                    Продолжить с Google
                </button>

                <div className="w-full flex items-center gap-4 mb-8 opacity-20">
                    <div className="flex-1 h-px bg-slate-900"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">или через почту</span>
                    <div className="flex-1 h-px bg-slate-900"></div>
                </div>

                {/* EMAIL FORM */}
                <div className="w-full space-y-3">
                    <input
                        type="email"
                        placeholder="Email"
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all text-sm font-medium"
                    />
                    <input
                        type="password"
                        placeholder="Пароль"
                        value={authPassword}
                        onChange={e => setAuthPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all text-sm font-medium"
                    />
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={login}
                            disabled={loading}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-indigo-100"
                        >
                            Войти
                        </button>
                        <button
                            onClick={signUp}
                            disabled={loading}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 px-6 rounded-2xl transition-all active:scale-[0.98]"
                        >
                            Создать
                        </button>
                    </div>
                </div>

                <p className="mt-12 text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em] text-center">
                    Безопасная синхронизация через Supabase
                </p>
            </div>
        </div>
    )
}

export default Auth
