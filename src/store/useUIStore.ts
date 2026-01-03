import { create } from 'zustand'

export type ToastType = 'error' | 'success' | 'info'

interface ToastMessage {
    message: string
    type: ToastType
}

interface UIStore {
    toast: ToastMessage | null
    showToast: (message: string, type?: ToastType) => void
    hideToast: () => void
}

export const useUIStore = create<UIStore>((set) => ({
    toast: null,

    showToast: (message, type = 'info') => {
        set({ toast: { message, type } })
        setTimeout(() => set({ toast: null }), 3000)
    },

    hideToast: () => set({ toast: null })
}))
