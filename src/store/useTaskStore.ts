import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../supabase'
import { format, isToday, parseISO } from 'date-fns'
import { useUIStore } from './useUIStore'
import { Task, Tag, List, Folder, TaskStatus } from '../types'

interface TaskStore {
    tasks: Task[]
    allTags: Tag[]
    allLists: List[]
    allFolders: Folder[]
    loading: boolean

    // Filters & View State
    selectedTagId: string | null
    selectedListId: string | null
    dateFilter: 'today' | 'tomorrow' | 'all' | 'no-date'
    searchQuery: string
    sortBy: 'order' | 'title' | 'date' | 'alpha'
    groupBy: 'none' | 'date' | 'list'
    activeView: 'tasks' | 'calendar'

    // UI State
    collapsedFolders: Record<string, boolean>
    toggleFolder: (id: string) => void

    // UI - Modal/Panel State
    isSidebarOpen: boolean
    isModalOpen: boolean
    isPanelOpen: boolean
    isSettingsOpen: boolean
    currentTaskId: string | null
    editingTaskId: string | null
    calendarDate: Date

    setCalendarDate: (date: Date) => void
    setIsSettingsOpen: (isOpen: boolean) => void
    setIsSidebarOpen: (isOpen: boolean) => void

    openTaskDetail: (task: Task, type?: 'panel' | 'modal') => void
    closeTaskDetail: () => void
    setEditingTaskId: (id: string | null) => void

    // Drag & Drop State
    draggedTaskId: string | null
    setDraggedTaskId: (id: string | null) => void

    setTasks: (tasks: Task[]) => void
    setLoading: (loading: boolean) => void
    setSelectedTagId: (id: string | null) => void
    setSelectedListId: (id: string | null) => void
    setDateFilter: (filter: 'today' | 'tomorrow' | 'all' | 'no-date') => void
    setSearchQuery: (query: string) => void
    setSortBy: (sort: 'order' | 'title' | 'date' | 'alpha') => void
    setGroupBy: (group: 'none' | 'date' | 'list') => void
    setActiveView: (view: 'tasks' | 'calendar') => void

    fetchData: (background?: boolean) => Promise<void>
    addTask: (title: string, list_id?: string | null, extras?: Partial<Task>) => Promise<Task | undefined>

    // CRUD
    createTag: (name: string) => Promise<void>
    createList: (name: string) => Promise<void>
    deleteTag: (id: string) => Promise<void>
    toggleTask: (id: string, currentStatus: TaskStatus) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    updateTask: (id: string, taskData: Partial<Task>, selectedTags?: Tag[]) => Promise<void>
    saveTask: (title: string, extras?: Partial<Task>) => Promise<void>

    onDropTaskOnTask: (draggedTaskId: string, targetTaskId: string) => Promise<void>
    onRemoveParent: (taskId: string) => Promise<void>
    onDropTaskReorder: (e: React.DragEvent, targetTaskId: string, position: 'top' | 'bottom') => Promise<void>
    onDropTaskOnCalendar: (taskId: string, date: Date, time?: string | null) => Promise<void>
    deleteFolder: (id: string) => Promise<void>
    onDropFolderSorting: (e: React.DragEvent, targetFolderId: string, position: 'top' | 'bottom') => Promise<void>
    onDropListSorting: (e: React.DragEvent, targetListId: string, position: 'top' | 'bottom') => Promise<void>
    deleteList: (e: React.MouseEvent | any, id: string) => Promise<void>
    onDrop: (e: React.DragEvent | any, folderId: string) => Promise<void>
    getSortedTasks: () => Task[]
}

export const useTaskStore = create<TaskStore>()(
    persist(
        (set, get) => ({
            tasks: [],
            allTags: [],
            allLists: [],
            allFolders: [],
            loading: false,

            selectedTagId: null,
            selectedListId: null,
            dateFilter: 'all',
            searchQuery: '',
            sortBy: 'order',
            groupBy: 'none',
            activeView: 'tasks',

            collapsedFolders: {},
            isSidebarOpen: false,
            isModalOpen: false,
            isPanelOpen: false,
            isSettingsOpen: false,
            currentTaskId: null,
            editingTaskId: null,
            calendarDate: new Date(),

            draggedTaskId: null,

            setCalendarDate: (date) => set({ calendarDate: date }),
            setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
            setIsSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
            setDraggedTaskId: (id) => set({ draggedTaskId: id }),

            setTasks: (tasks) => set({ tasks }),
            setLoading: (loading) => set({ loading }),
            setSelectedTagId: (id) => set({ selectedTagId: id, selectedListId: null, dateFilter: 'all' }),
            setSelectedListId: (id) => set({ selectedListId: id, selectedTagId: null, dateFilter: 'all' }),
            setDateFilter: (filter) => set({ dateFilter: filter, selectedListId: null, selectedTagId: null }),
            setSearchQuery: (query) => set({ searchQuery: query }),
            setSortBy: (sort) => set({ sortBy: sort }),
            setGroupBy: (group) => set({ groupBy: group }),
            setActiveView: (view) => set({ activeView: view }),

            toggleFolder: (id) => set(state => ({
                collapsedFolders: { ...state.collapsedFolders, [id]: !state.collapsedFolders[id] }
            })),

            openTaskDetail: (task, type = 'modal') => {
                set({
                    currentTaskId: task.id,
                    isModalOpen: type === 'modal',
                    isPanelOpen: type === 'panel'
                })
            },

            closeTaskDetail: () => set({ isModalOpen: false, isPanelOpen: false, currentTaskId: null }),
            setEditingTaskId: (id) => set({ editingTaskId: id }),

            fetchData: async (background = false) => {
                if (!background) set({ loading: true })
                try {
                    const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*').order('order_index')
                    const { data: tags, error: tagsError } = await supabase.from('tags').select('*')
                    const { data: lists, error: listsError } = await supabase.from('lists').select('*').order('order_index')
                    const { data: folders, error: foldersError } = await supabase.from('folders').select('*').order('order_index')

                    if (tasksError) throw tasksError
                    if (tagsError) throw tagsError
                    if (listsError) throw listsError
                    if (foldersError) throw foldersError

                    set({ tasks: tasks || [], allTags: tags || [], allLists: lists || [], allFolders: folders || [] })
                } catch (error: any) {
                    console.error('Error fetching data:', error)
                    useUIStore.getState().showToast('Ошибка загрузки данных: ' + error.message, 'error')
                } finally {
                    set({ loading: false })
                }
            },

            addTask: async (title, list_id = null, extras = {}) => {
                try {
                    const user = (await supabase.auth.getUser()).data.user
                    if (!user) return

                    const newTaskPayload = {
                        title,
                        list_id: list_id || extras.list_id || get().selectedListId,
                        user_id: user.id,
                        status: extras.status || 'todo' as TaskStatus,
                        is_project: extras.is_project || false,
                        order_index: extras.order_index || 0,
                        due_date: extras.due_date,
                        due_time: extras.due_time,
                        end_time: extras.end_time,
                        end_date: extras.end_date || extras.due_date
                    }

                    const { data, error } = await supabase.from('tasks').insert([newTaskPayload]).select()
                    if (error) throw error
                    if (data) {
                        get().fetchData(true)
                        return data[0] as Task
                    }
                } catch (error: any) {
                    console.error('Error adding task:', error)
                    useUIStore.getState().showToast('Ошибка создания задачи', 'error')
                }
            },

            saveTask: async (title, extras = {}) => {
                await get().addTask(title, null, extras)
            },

            toggleTask: async (id, currentStatus) => {
                const newStatus = currentStatus === 'done' ? 'todo' : 'done'
                const optimisticTasks = get().tasks.map(t => t.id === id ? { ...t, status: newStatus as TaskStatus } : t)
                set({ tasks: optimisticTasks })

                try {
                    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id)
                    if (error) throw error
                } catch (error) {
                    set({ tasks: get().tasks }) // Rollback
                }
            },

            deleteTask: async (id) => {
                const optimisticTasks = get().tasks.filter(t => t.id !== id)
                set({ tasks: optimisticTasks })
                try {
                    const { error } = await supabase.from('tasks').delete().eq('id', id)
                    if (error) throw error
                } catch (error) {
                    get().fetchData(true)
                }
            },

            updateTask: async (id, taskData, selectedTags) => {
                const optimisticTasks = get().tasks.map(t => t.id === id ? { ...t, ...taskData } : t)
                set({ tasks: optimisticTasks })

                try {
                    const { error } = await supabase.from('tasks').update(taskData).eq('id', id)
                    if (error) throw error

                    // Handle tags if needed...
                } catch (error) {
                    get().fetchData(true)
                }
            },

            createTag: async (name) => {
                try {
                    const user = (await supabase.auth.getUser()).data.user
                    if (!user) return
                    await supabase.from('tags').insert([{ name, user_id: user.id }])
                    get().fetchData(true)
                } catch (error) { }
            },

            deleteTag: async (id) => {
                try {
                    await supabase.from('tags').delete().eq('id', id)
                    get().fetchData(true)
                } catch (error) { }
            },

            createList: async (name) => {
                try {
                    const user = (await supabase.auth.getUser()).data.user
                    if (!user) return
                    await supabase.from('lists').insert([{ name, user_id: user.id }])
                    get().fetchData(true)
                } catch (error) { }
            },

            deleteList: async (e, id) => {
                e?.stopPropagation()
                try {
                    await supabase.from('lists').delete().eq('id', id)
                    get().fetchData(true)
                } catch (error) { }
            },

            deleteFolder: async (id) => {
                try {
                    await supabase.from('folders').delete().eq('id', id)
                    get().fetchData(true)
                } catch (error) { }
            },

            onDrop: async (e, folderId) => {
                const listId = e.dataTransfer.getData('listId')
                if (!listId) return
                try {
                    await supabase.from('lists').update({ folder_id: folderId || null }).eq('id', listId)
                    get().fetchData(true)
                } catch (error) { }
            },

            onDropTaskOnTask: async (draggedTaskId, targetTaskId) => {
                try {
                    await supabase.from('tasks').update({ parent_id: targetTaskId }).eq('id', draggedTaskId)
                    get().fetchData(true)
                } catch (error) { }
            },

            onRemoveParent: async (taskId) => {
                try {
                    await supabase.from('tasks').update({ parent_id: null }).eq('id', taskId)
                    get().fetchData(true)
                } catch (error) { }
            },

            onDropTaskReorder: async (e, targetTaskId, position) => {
                // Simplified reorder logic
                get().fetchData(true)
            },

            onDropTaskOnCalendar: async (taskId, date, time = null) => {
                const updateData: any = {
                    due_date: format(date, 'yyyy-MM-dd'),
                    end_date: format(date, 'yyyy-MM-dd')
                }
                if (time) updateData.due_time = time

                const optimisticTasks = get().tasks.map(t => t.id === taskId ? { ...t, ...updateData } : t)
                set({ tasks: optimisticTasks })

                try {
                    await supabase.from('tasks').update(updateData).eq('id', taskId)
                } catch (error) {
                    get().fetchData(true)
                }
            },

            onDropFolderSorting: async (e, targetFolderId, position) => { get().fetchData(true) },
            onDropListSorting: async (e, targetListId, position) => { get().fetchData(true) },

            getSortedTasks: () => {
                const { tasks, searchQuery, selectedTagId, selectedListId, dateFilter, sortBy } = get()
                return tasks
                    .filter(t => {
                        if (searchQuery) return t.title.toLowerCase().includes(searchQuery.toLowerCase())
                        if (selectedTagId) return t.tags && t.tags.some(tag => tag.id === selectedTagId)
                        if (selectedListId) return t.list_id === selectedListId
                        if (dateFilter === 'today') return t.due_date && isToday(parseISO(t.due_date))
                        return true
                    })
                    .sort((a, b) => {
                        if (sortBy === 'title') return a.title.localeCompare(b.title)
                        return (a.order_index || 0) - (b.order_index || 0)
                    })
            }
        }),
        {
            name: 'pulse-task-storage',
            partialize: (state) => ({
                collapsedFolders: state.collapsedFolders,
                selectedListId: state.selectedListId,
                activeView: state.activeView
            }),
        }
    )
)
