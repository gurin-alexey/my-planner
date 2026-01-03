import React from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { useTaskStore } from '../../store/useTaskStore'
import { useUserSettings } from '../../hooks/useUserSettings'

const SettingsModal: React.FC = () => {
    // Store State
    const isOpen = useTaskStore(state => state.isSettingsOpen)
    const onClose = () => useTaskStore.getState().setIsSettingsOpen(false)

    const session = useAuthStore(state => state.session)
    const authLoading = useAuthStore(state => state.loading)
    const authEmail = useAuthStore(state => state.authEmail)
    const authPassword = useAuthStore(state => state.authPassword)

    // Actions
    const setAuthEmail = useAuthStore(state => state.setAuthEmail)
    const setAuthPassword = useAuthStore(state => state.setAuthPassword)
    const handleLogin = useAuthStore(state => state.login)
    const handleSignUp = useAuthStore(state => state.signUp)
    const handleLogout = useAuthStore(state => state.logout)
    const handleGoogleLogin = useAuthStore(state => state.loginWithGoogle)

    // User Settings
    const {
        isNightHidden, setIsNightHidden,
        workingStart, setWorkingStart,
        workingEnd, setWorkingEnd
    } = useUserSettings()

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden z-[210] animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-800">Настройки</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition">✕</button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh] no-scrollbar">

                    {/* Account Section */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Аккаунт</h4>
                        {session ? (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]">{session.user.email}</span>
                                <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 font-bold">Выйти</button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={authEmail}
                                    onChange={e => setAuthEmail(e.target.value)}
                                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 transition"
                                />
                                <input
                                    type="password"
                                    placeholder="Пароль"
                                    value={authPassword}
                                    onChange={e => setAuthPassword(e.target.value)}
                                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 transition"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleLogin}
                                        disabled={authLoading}
                                        className="flex-1 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                                    >
                                        {authLoading ? '...' : 'Войти'}
                                    </button>
                                    <button
                                        onClick={handleSignUp}
                                        disabled={authLoading}
                                        className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                                    >
                                        Регистрация
                                    </button>
                                </div>
                                <button
                                    onClick={handleGoogleLogin}
                                    className="w-full mt-2 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition flex items-center justify-center gap-2"
                                >
                                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4" alt="G" />
                                    Войти через Google
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Toggle Hide Non-Working */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-slate-700">Скрыть нерабочее время</span>
                            <span className="text-[11px] text-slate-400">Показывать часы только с {workingStart}:00 до {workingEnd}:00</span>
                        </div>
                        <button
                            onClick={() => setIsNightHidden(!isNightHidden)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${isNightHidden ? 'bg-indigo-600' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${isNightHidden ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="border-t border-slate-100 my-4"></div>

                    {/* Working Hours Inputs */}
                    <div className="space-y-4">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Рабочие часы</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-xs text-slate-500 font-medium ml-1">Начало</span>
                                <input
                                    type="number"
                                    min="0" max="23"
                                    value={workingStart}
                                    onChange={e => setWorkingStart(Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                                />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-slate-500 font-medium ml-1">Конец</span>
                                <input
                                    type="number"
                                    min="0" max="23"
                                    value={workingEnd}
                                    onChange={e => setWorkingEnd(Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                                />
                            </div>
                        </div>
                    </div>

                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-indigo-200"
                    >
                        Готово
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
