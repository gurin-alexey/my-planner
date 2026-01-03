import React, { useEffect } from 'react'
import { supabase } from './supabase'
import SidebarContent from './components/Sidebar'
import CalendarView from './components/Calendar'
import TaskDetail from './components/TaskDetail'
import TaskList from './components/TaskList'
import SettingsModal from './components/SettingsModal'
import Toast from './components/Toast'

import { useAuthStore } from './store/useAuthStore'
import { useTaskStore } from './store/useTaskStore'
import { List } from './types'

function App() {
  // Ensure initSession is stable or used safely
  const initSession = useAuthStore(state => state.initSession)
  const session = useAuthStore(state => state.session)
  const fetchData = useTaskStore(state => state.fetchData)
  const activeView = useTaskStore(state => state.activeView)

  const activeListName = useTaskStore(state => {
    const list = state.allLists.find((l: List) => l.id === state.selectedListId)
    return list ? list.name : 'Задачи'
  })

  const saveTask = useTaskStore(state => state.saveTask)

  // UI - Modal/Panel Visibility from Store
  const isPanelOpen = useTaskStore(state => state.isPanelOpen)
  const isModalOpen = useTaskStore(state => state.isModalOpen)
  const setIsSettingsOpen = useTaskStore(state => state.setIsSettingsOpen)

  // Initial Session Load
  useEffect(() => {
    initSession()
  }, [])

  // Reactive Data Fetching on Session Change
  useEffect(() => {
    if (session?.user?.id) {
      fetchData()
    }
  }, [session?.user?.id]) // Only re-fetch if USER ID changes (login/logout/switch)

  useEffect(() => {
    // Auth Listener for cleanup (though onAuthStateChange is handled in store, we might need global reset here if store doesn't handle everything)
    // Actually useAuthStore handles onAuthStateChange internally for session state.
    // But we need to clear tasks on logout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        useTaskStore.getState().setTasks([])
        useTaskStore.getState().setLoading(false)
      }
    })

    // Polling interval (only if session exists)
    let interval: NodeJS.Timeout
    if (session?.user?.id) {
      interval = setInterval(() => fetchData(true), 30000)
    }

    return () => {
      if (interval) clearInterval(interval)
      subscription.unsubscribe()
    }
  }, [session?.user?.id]) // Re-subscribe if user changes

  return (
    <div className="h-screen bg-white flex font-sans text-[#333] overflow-hidden selection:bg-indigo-100 relative">
      <aside className="hidden md:block w-64 flex-shrink-0 sticky top-0 h-screen overflow-hidden border-r border-slate-100">
        <SidebarContent />
      </aside>

      <main className="flex-1 h-full flex flex-col items-stretch overflow-hidden relative">
        <div className={`w-full mx-auto md:mx-0 flex flex-col flex-1 overflow-hidden ${activeView === 'calendar' ? '' : 'max-w-4xl px-4 py-8'}`}>
          <header className="flex justify-between items-center mb-6 px-2">
            <h1 className="text-2xl font-black text-slate-800">
              {activeView === 'calendar' ? 'Календарь' : activeListName}
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => document.dispatchEvent(new CustomEvent('toggle-search'))}
                className="p-2 hover:bg-slate-100 rounded-xl transition"
                aria-label="Search"
              >
                🔍
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-xl transition"
                aria-label="Settings"
              >
                ⚙️
              </button>
            </div>
          </header>

          {activeView === 'tasks' ? (
            <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
              <input
                type="text" placeholder="+ Новая задача"
                className="w-full bg-slate-100 rounded-2xl px-5 py-4 mb-6 outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  const target = e.target as HTMLInputElement
                  if (e.key === 'Enter' && target.value.trim()) {
                    saveTask(target.value)
                    target.value = ''
                  }
                }}
              />
              <TaskList />
            </div>
          ) : (
            <CalendarView />
          )}
        </div>
      </main>

      {/* DETAILED PANEL (Desktop) */}
      {isPanelOpen && (
        <aside className="hidden lg:flex flex-col w-[400px] border-l border-slate-100 bg-white animate-in slide-in-from-right duration-300">
          <TaskDetail mode="panel" />
        </aside>
      )}

      {/* MOBILE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => useTaskStore.getState().closeTaskDetail()}
          />
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl z-[160] overflow-hidden animate-in slide-in-from-bottom duration-300">
            <TaskDetail mode="modal" />
          </div>
        </div>
      )}

      <SettingsModal />
      <Toast />

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  )
}

export default App
