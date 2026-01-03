import React, { useEffect } from 'react'
import { useUIStore } from '../../store/useUIStore'

const Toast = () => {
    const toast = useUIStore(state => state.toast)
    const hideToast = useUIStore(state => state.hideToast)

    if (!toast) return null

    const bgColors = {
        error: 'bg-red-500',
        success: 'bg-green-500',
        info: 'bg-slate-800'
    }

    return (
        <div className={`fixed bottom-4 right-4 z-[300] ${bgColors[toast.type] || 'bg-slate-800'} text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300`}>
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
            <span className="font-medium text-sm">{toast.message}</span>
            <button onClick={hideToast} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
    )
}

export default Toast
