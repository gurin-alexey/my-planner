import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { format, isToday, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

export function useTasks(session) {
    const [tasks, setTasks] = useState([])
    const [allTags, setAllTags] = useState([])
    const [allLists, setAllLists] = useState([])
    const [allFolders, setAllFolders] = useState([])
    const [loading, setLoading] = useState(true)
    const lastFetchedTasksJson = useRef('')

    // Filters & View State
    const [selectedTagId, setSelectedTagId] = useState(null)
    const [selectedListId, setSelectedListId] = useState(null)
    const [dateFilter, setDateFilter] = useState('today')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('order')
    const [groupBy, setGroupBy] = useState('none')
    const [activeView, setActiveView] = useState('tasks')

    const fetchData = useCallback(async (background = false) => {
        if (!background) setLoading(true)
        try {
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

            if (tagsRes.data) setAllTags(tagsRes.data)
            if (listsRes.data) setAllLists(listsRes.data)
            if (foldersRes.data) setAllFolders(foldersRes.data)

            if (tasksRes.data) {
                const formattedTasks = tasksRes.data.map(task => ({
                    ...task,
                    tags: task.tags ? task.tags.map(t => t.tags).filter(Boolean) : []
                }))

                const tasksJson = JSON.stringify(formattedTasks)
                if (tasksJson !== lastFetchedTasksJson.current) {
                    lastFetchedTasksJson.current = tasksJson
                    setTasks(formattedTasks)
                }
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
        const interval = setInterval(() => fetchData(true), 20000)
        return () => clearInterval(interval)
    }, [fetchData])

    // --- ACTIONS ---
    const saveTask = async (title, list_id = null) => {
        const user = (await supabase.auth.getUser()).data.user
        if (!user) return

        const { data, error } = await supabase.from('tasks').insert([{
            title,
            list_id: list_id || selectedListId,
            user_id: user.id,
            created_at: new Date().toISOString()
        }]).select()

        if (!error && data) {
            fetchData(true)
            return data[0]
        }
    }

    const toggleTask = async (id, is_completed) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, is_completed: !is_completed } : t))
        await supabase.from('tasks').update({ is_completed: !is_completed }).eq('id', id)
        fetchData(true)
    }

    const deleteTask = async (id) => {
        setTasks(prev => prev.filter(t => t.id !== id))
        await supabase.from('tasks').delete().eq('id', id)
        fetchData(true)
    }

    const updateTask = async (id, taskData, selectedTags) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...taskData, tags: selectedTags } : t))
        try {
            await supabase.from('tasks').update(taskData).eq('id', id)
            await supabase.from('task_tags').delete().eq('task_id', id)
            if (selectedTags?.length > 0) {
                await supabase.from('task_tags').insert(selectedTags.map(tag => ({ task_id: id, tag_id: tag.id })))
            }
        } catch (e) {
            console.error('Update task error:', e)
        }
    }

    const onDropTaskOnTask = async (draggedTaskId, targetTaskId) => {
        if (!draggedTaskId || !targetTaskId || String(draggedTaskId) === String(targetTaskId)) return
        const targetTask = tasks.find(t => String(t.id) === String(targetTaskId))
        if (targetTask?.parent_id) return

        setTasks(prev => prev.map(t => String(t.id) === String(draggedTaskId) ? { ...t, parent_id: targetTaskId } : t))
        await supabase.from('tasks').update({ parent_id: targetTaskId }).eq('id', draggedTaskId)
        fetchData(true)
    }

    const onRemoveParent = async (taskId) => {
        if (!taskId) return
        setTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, parent_id: null } : t))
        await supabase.from('tasks').update({ parent_id: null }).eq('id', taskId)
        fetchData(true)
    }

    const onDropTaskReorder = async (e, targetTaskId, position) => {
        const draggedId = e.dataTransfer.getData('taskId')
        if (!draggedId || draggedId === targetTaskId) return

        const targetIdx = tasks.findIndex(t => t.id === targetTaskId)
        const draggedIdx = tasks.findIndex(t => t.id === draggedId)
        if (targetIdx === -1 || draggedIdx === -1) return

        const newTasks = [...tasks]
        const [draggedItem] = newTasks.splice(draggedIdx, 1)
        const newTargetIdx = newTasks.findIndex(t => t.id === targetTaskId)
        const pos = position === 'top' ? newTargetIdx : newTargetIdx + 1
        newTasks.splice(pos, 0, draggedItem)

        setTasks(newTasks)

        const updates = newTasks.map((t, i) => ({ id: t.id, order_index: i }))
        for (const up of updates) {
            await supabase.from('tasks').update({ order_index: up.order_index }).eq('id', up.id)
        }
        fetchData(true)
    }

    const onDropTaskOnCalendar = async (taskId, date, time = null) => {
        if (!taskId) return
        const localTask = tasks.find(t => String(t.id) === String(taskId))
        const newDateStr = format(date, 'yyyy-MM-dd')

        let updateData = { due_date: newDateStr }

        if (time && time !== 'all-day') {
            const start = new Date(`${newDateStr}T${time}`)
            const end = new Date(start.getTime() + 60 * 60000)
            updateData = { ...updateData, due_time: time, end_date: format(end, 'yyyy-MM-dd'), end_time: format(end, 'HH:mm:ss') }
        } else {
            updateData = { ...updateData, due_time: null, end_date: newDateStr, end_time: null }
        }

        setTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, ...updateData } : t))
        await supabase.from('tasks').update(updateData).eq('id', taskId)
        fetchData(true)
    }

    // --- FILTERING & GROUPING LOGIC ---
    const sortedTasks = tasks
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

    const groupedTasks = (() => {
        if (selectedListId) {
            const list = allLists.find(l => l.id === selectedListId)
            return [{ name: list?.name || 'Список', tasks: sortedTasks }]
        }
        if (dateFilter === 'today') return [{ name: 'Сегодня', tasks: sortedTasks }]

        const groups = {}
        sortedTasks.forEach(t => {
            const dateKey = t.due_date || 'No Date'
            if (!groups[dateKey]) groups[dateKey] = []
            groups[dateKey].push(t)
        })
        return Object.keys(groups).sort().map(key => ({
            name: key === 'No Date' ? 'Без даты' : format(parseISO(key), 'd MMMM', { locale: ru }),
            tasks: groups[key]
        }))
    })()

    return {
        tasks, allTags, allLists, allFolders, loading,
        setTasks, fetchData, saveTask, deleteTask, toggleTask, updateTask,
        onDropTaskOnTask, onRemoveParent, onDropTaskReorder, onDropTaskOnCalendar,
        selectedTagId, setSelectedTagId,
        selectedListId, setSelectedListId,
        dateFilter, setDateFilter,
        searchQuery, setSearchQuery,
        sortBy, setSortBy,
        groupBy, setGroupBy,
        activeView, setActiveView,
        sortedTasks, groupedTasks
    }
}
