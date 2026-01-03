import { create } from 'zustand'
import { supabase } from '../supabase'
import { format, isToday, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
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
    addTask: (title: string, list_id?: string | null) => Promise<Task | undefined>

    // CRUD
    createTag: (name: string) => Promise<void>
    createList: (name: string) => Promise<void>
    deleteTag: (e: any, id: string) => Promise<void>
    toggleTask: (id: string, currentStatus: TaskStatus) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    updateTask: (id: string, taskData: Partial<Task>, selectedTags?: Tag[]) => Promise<void>
    saveTask: (title: string) => Promise<void>

    onDropTaskOnTask: (draggedTaskId: string, targetTaskId: string) => Promise<void>
    onRemoveParent: (taskId: string) => Promise<void>
    onDropTaskReorder: (e: React.DragEvent, targetTaskId: string, position: 'top' | 'bottom') => Promise<void>
    onDropTaskOnCalendar: (taskId: string, date: Date, time?: string | null) => Promise<void>

    deleteList: (e: React.MouseEvent, id: string) => Promise<void>
    deleteFolder: (e: React.MouseEvent, id: string) => Promise<void>

    onDropFolderSorting: (e: React.DragEvent, targetFolderId: string, position: any) => Promise<void>
    onDropListSorting: (e: React.DragEvent, targetListId: string, position: any) => Promise<void>
    onDropTask: (e: React.DragEvent, listId: string) => Promise<void>
    onDrop: (e: React.DragEvent, folderId: string) => Promise<void>

    getSortedTasks: () => Task[]
    getGroupedTasks: () => { name: string, tasks: Task[] }[]
}

export const useTaskStore = create<TaskStore>((set, get) => ({
    tasks: [],
    allTags: [],
    allLists: [],
    allFolders: [],
    loading: true,

    // Filters & View State
    selectedTagId: null,
    selectedListId: null,
    dateFilter: 'today',
    searchQuery: '',
    sortBy: 'order',
    groupBy: 'none',
    activeView: 'tasks',

    // UI State
    collapsedFolders: {},
    toggleFolder: (id) => set(state => ({ collapsedFolders: { ...state.collapsedFolders, [id]: !state.collapsedFolders[id] } })),

    // UI - Modal/Panel State
    isSidebarOpen: false,
    isModalOpen: false,
    isPanelOpen: false,
    isSettingsOpen: false,
    currentTaskId: null,
    editingTaskId: null,
    calendarDate: new Date(),

    setCalendarDate: (date) => set({ calendarDate: date }),
    setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
    setIsSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

    openTaskDetail: (task, type = 'panel') => set({
        currentTaskId: task.id,
        isModalOpen: type === 'modal',
        isPanelOpen: type === 'panel'
    }),
    closeTaskDetail: () => set({
        isModalOpen: false,
        isPanelOpen: false,
        currentTaskId: null
    }),
    setEditingTaskId: (id) => set({ editingTaskId: id }),


    // Drag & Drop State
    draggedTaskId: null,
    setDraggedTaskId: (id) => set({ draggedTaskId: id }),

    setTasks: (tasks) => set({ tasks }),
    setLoading: (loading) => set({ loading }),
    setSelectedTagId: (id) => set({ selectedTagId: id }),
    setSelectedListId: (id) => set({ selectedListId: id }),
    setDateFilter: (filter) => set({ dateFilter: filter }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSortBy: (sort) => set({ sortBy: sort }),
    setGroupBy: (group) => set({ groupBy: group }),
    setActiveView: (view) => set({ activeView: view }),

    fetchData: async (background = false) => {
        if (!background) set({ loading: true })
        try {
            // const { data: { session } } = await supabase.auth.getSession()
            // console.log('fetchData called. User ID:', session?.user?.id)

            const [tagsRes, listsRes, foldersRes, tasksRes] = await Promise.all([
                supabase.from('tags').select('*').order('name'),
                supabase.from('lists').select('*').order('order_index', { ascending: true }),
                supabase.from('folders').select('*').order('order_index', { ascending: true }),
                supabase
                    .from('tasks')
                    .select('*, tags:task_tags(tag_id, tags(*))')
                    .order('order_index', { ascending: true })
                    .order('id', { ascending: false })
            ])

            if (tagsRes.data) set({ allTags: tagsRes.data as Tag[] })
            if (listsRes.data) set({ allLists: listsRes.data as List[] })
            if (foldersRes.data) set({ allFolders: foldersRes.data as Folder[] })

            if (tasksRes.data) {
                const formattedTasks = tasksRes.data.map((task: any) => ({
                    ...task,
                    tags: task.tags ? task.tags.map((t: any) => t.tags).filter(Boolean) : []
                }))
                // console.log(`Loaded ${formattedTasks.length} tasks from Supabase`)
                set({ tasks: formattedTasks as Task[] })
            }
        } catch (e: any) {
            console.error(e)
            useUIStore.getState().showToast('Ошибка загрузки данных: ' + e.message, 'error')
        } finally {
            set({ loading: false })
        }
    },

    addTask: async (title, list_id = null) => {
        try {
            const user = (await supabase.auth.getUser()).data.user
            if (!user) return

            if (!user) return

            const newTaskPayload = {
                title,
                list_id: list_id || get().selectedListId,
                user_id: user.id,
                status: 'todo' as TaskStatus,
                is_project: false,
                order_index: 0
            }

            const { data, error } = await supabase.from('tasks').insert([newTaskPayload]).select()

            if (error) throw error
            if (data) {
                get().fetchData(true)
                return data[0] as Task
            }
        } catch (error: any) {
            console.error('Error adding task:', error)
            useUIStore.getState().showToast('Ошибка создания задачи: ' + (error.message || error), 'error')
        }
    },

    saveTask: async (title) => {
        await get().addTask(title)
    },

    toggleTask: async (id, currentStatus) => {
        const tasks = get().tasks
        const newStatus: TaskStatus = currentStatus === 'done' ? 'todo' : 'done'
        const now = new Date().toISOString() // Used for optimistic update

        // Optimistic update
        set({ tasks: tasks.map(t => t.id === id ? { ...t, status: newStatus, updated_at: now } : t) })

        try {
            await supabase.from('tasks').update({ status: newStatus }).eq('id', id)
            get().fetchData(true)
        } catch (error) {
            console.error('Error toggling task:', error)
            useUIStore.getState().showToast('Не удалось обновить задачу', 'error')
        }
    },

    deleteTask: async (id) => {
        const tasks = get().tasks
        set({ tasks: tasks.filter(t => t.id !== id) })
        try {
            await supabase.from('tasks').delete().eq('id', id)
            get().fetchData(true)
        } catch (error) {
            console.error('Error deleting task:', error)
            useUIStore.getState().showToast('Ошибка удаления задачи', 'error')
        }
    },

    updateTask: async (id, taskData, selectedTags) => {
        const tasks = get().tasks
        const updated_at = new Date().toISOString()
        const fullUpdateData = { ...taskData, updated_at }

        set({ tasks: tasks.map(t => t.id === id ? { ...t, ...fullUpdateData, tags: selectedTags !== undefined ? selectedTags : t.tags } : t) })

        try {
            await supabase.from('tasks').update(fullUpdateData).eq('id', id)

            if (selectedTags) {
                await supabase.from('task_tags').delete().eq('task_id', id)
                if (selectedTags.length > 0) {
                    await supabase.from('task_tags').insert(selectedTags.map(tag => ({ task_id: id, tag_id: tag.id })))
                }
            }
        } catch (e: any) {
            console.error('Update task error:', e)
            useUIStore.getState().showToast('Ошибка сохранения', 'error')
        }
    },

    onDropTaskOnTask: async (draggedTaskId, targetTaskId) => {
        if (!draggedTaskId || !targetTaskId || String(draggedTaskId) === String(targetTaskId)) return
        const tasks = get().tasks
        const targetTask = tasks.find(t => String(t.id) === String(targetTaskId))
        if (targetTask?.parent_id) return

        const updated_at = new Date().toISOString()
        set({ tasks: tasks.map(t => String(t.id) === String(draggedTaskId) ? { ...t, parent_id: targetTaskId, updated_at } : t) })
        try {
            await supabase.from('tasks').update({ parent_id: targetTaskId, updated_at }).eq('id', draggedTaskId)
            get().fetchData(true)
        } catch (error) {
            console.error('Error dropping task:', error)
        }
    },

    onRemoveParent: async (taskId) => {
        if (!taskId) return
        const tasks = get().tasks
        const updated_at = new Date().toISOString()
        set({ tasks: tasks.map(t => String(t.id) === String(taskId) ? { ...t, parent_id: null, updated_at } : t) })
        try {
            await supabase.from('tasks').update({ parent_id: null, updated_at }).eq('id', taskId)
            get().fetchData(true)
        } catch (error) {
            console.error('Error removing parent:', error)
        }
    },

    onDropTaskReorder: async (e, targetTaskId, position) => {
        const draggedId = e.dataTransfer.getData('taskId')
        if (!draggedId || draggedId === targetTaskId) return

        const tasks = get().tasks
        const targetIdx = tasks.findIndex(t => t.id === targetTaskId)
        const draggedIdx = tasks.findIndex(t => t.id === draggedId)
        if (targetIdx === -1 || draggedIdx === -1) return

        const newTasks = [...tasks]
        const [draggedItem] = newTasks.splice(draggedIdx, 1)
        const newTargetIdx = newTasks.findIndex(t => t.id === targetTaskId)
        const pos = position === 'top' ? newTargetIdx : newTargetIdx + 1
        newTasks.splice(pos, 0, draggedItem)

        set({ tasks: newTasks })

        const updates = newTasks.map((t, i) => ({ id: t.id, order_index: i }))
        try {
            for (const up of updates) {
                await supabase.from('tasks').update({ order_index: up.order_index }).eq('id', up.id)
            }
            get().fetchData(true)
        } catch (error) {
            console.error('Error reordering tasks:', error)
        }
    },

    onDropTaskOnCalendar: async (taskId, date, time = null) => {
        if (!taskId) return
        const tasks = get().tasks
        const newDateStr = format(date, 'yyyy-MM-dd')
        const updated_at = new Date().toISOString()

        let updateData: Partial<Task> = { due_date: newDateStr, updated_at }

        if (time && time !== 'all-day') {
            const start = new Date(`${newDateStr}T${time}`)
            const end = new Date(start.getTime() + 60 * 60000)
            updateData = { ...updateData, due_time: time, end_date: format(end, 'yyyy-MM-dd'), end_time: format(end, 'HH:mm:ss') }
        } else {
            updateData = { ...updateData, due_time: null, end_date: newDateStr, end_time: null }
        }

        set({ tasks: tasks.map(t => String(t.id) === String(taskId) ? { ...t, ...updateData } : t) })
        try {
            await supabase.from('tasks').update(updateData).eq('id', taskId)
            get().fetchData(true)
        } catch (error) {
            console.error('Error dropping on calendar:', error)
        }
    },

    // --- TAGS/LISTS/FOLDERS ACTIONS ---
    createTag: async (name) => {
        try {
            const user = (await supabase.auth.getUser()).data.user
            if (!user) return
            const { error } = await supabase.from('tags').insert([{ name, color: '#6366f1', user_id: user.id }])
            if (error) throw error
            get().fetchData(true)
        } catch (error) { console.error('Error creating tag:', error) }
    },
    createList: async (name) => {
        try {
            const user = (await supabase.auth.getUser()).data.user
            if (!user) return
            const { error } = await supabase.from('lists').insert([{
                name,
                order_index: get().allLists.length,
                folder_id: null // Explicitly null
            }])
            if (error) throw error
            get().fetchData(true)
        } catch (error: any) {
            console.error('Error creating list:', error)
            useUIStore.getState().showToast('Ошибка создания списка: ' + (error.message || error), 'error')
        }
    },
    deleteTag: async (e, id) => {
        e.stopPropagation()
        if (!window.confirm('Удалить метку?')) return
        try {
            await supabase.from('tags').delete().eq('id', id)
            get().fetchData(true)
        } catch (error) { console.error('Error deleting tag:', error) }
    },
    deleteList: async (e, id) => {
        e.stopPropagation()
        if (!window.confirm('Удалить список?')) return
        try {
            await supabase.from('lists').delete().eq('id', id)
            get().fetchData(true)
        } catch (error) { console.error('Error deleting list:', error) }
    },
    deleteFolder: async (e, id) => {
        e.stopPropagation()
        if (!window.confirm('Удалить папку?')) return
        try {
            await supabase.from('folders').delete().eq('id', id)
            get().fetchData(true)
        } catch (error) { console.error('Error deleting folder:', error) }
    },

    // Sorting/DnD for Sidebar
    onDropFolderSorting: async (e, targetFolderId, _position) => {
        const draggedFolderId = e.dataTransfer.getData('folderId')
        if (!draggedFolderId || draggedFolderId === targetFolderId) return
        console.log('Folder sort not fully implemented')
    },
    onDropListSorting: async (e, targetListId, _position) => {
        const draggedListId = e.dataTransfer.getData('listIdForSort')
        if (!draggedListId || draggedListId === targetListId) return
        console.log('List sort not fully implemented')
    },
    onDropTask: async (e, listId) => {
        const taskId = e.dataTransfer.getData('taskId')
        if (!taskId) return
        try {
            const updated_at = new Date().toISOString()
            const updates = { list_id: listId, updated_at }
            // Optimistic update
            const tasks = get().tasks
            set({ tasks: tasks.map(t => String(t.id) === String(taskId) ? { ...t, list_id: listId, updated_at } : t) })
            await supabase.from('tasks').update(updates).eq('id', taskId)
            get().fetchData(true)
        } catch (error) { console.error('Error dropping task on list:', error) }
    },
    onDrop: async (e, folderId) => {
        const listId = e.dataTransfer.getData('listId')
        if (!listId) return
        try {
            await supabase.from('lists').update({ folder_id: folderId }).eq('id', listId)
            get().fetchData(true)
        } catch (error) { console.error('Error dropping list on folder:', error) }
    },

    // Selectors
    getSortedTasks: () => {
        const { tasks, searchQuery, selectedTagId, selectedListId, activeView, dateFilter, sortBy } = get()
        return tasks
            .filter(t => {
                if (searchQuery) return t.title.toLowerCase().includes(searchQuery.toLowerCase())
                if (selectedTagId) return t.tags && t.tags.some(tag => tag.id === selectedTagId)
                if (selectedListId) return t.list_id === selectedListId
                if (activeView === 'calendar') return true

                if (dateFilter === 'today') {
                    if (!t.due_date) return false
                    return isToday(parseISO(t.due_date))
                }
                if (dateFilter === 'all') return true
                if (dateFilter === 'no-date') return !t.due_date
                return true
            })
            .sort((a, b) => {
                if (sortBy === 'title') return a.title.localeCompare(b.title)
                if (sortBy === 'date') return (a.due_date || '9999').localeCompare(b.due_date || '9999')
                return (a.order_index || 0) - (b.order_index || 0)
            })
    },

    getGroupedTasks: () => {
        const { selectedListId, allLists, dateFilter } = get()
        const sortedTasks = get().getSortedTasks()

        if (selectedListId) {
            const list = allLists.find(l => l.id === selectedListId)
            return [{ name: list?.name || 'Список', tasks: sortedTasks }]
        }
        if (dateFilter === 'today') return [{ name: 'Сегодня', tasks: sortedTasks }]

        const groups: Record<string, Task[]> = {}
        sortedTasks.forEach(t => {
            const dateKey = t.due_date || 'No Date'
            if (!groups[dateKey]) groups[dateKey] = []
            groups[dateKey].push(t)
        })
        return Object.keys(groups).sort().map(key => ({
            name: key === 'No Date' ? 'Без даты' : format(parseISO(key), 'd MMMM', { locale: ru }),
            tasks: groups[key]
        }))
    }
}))
