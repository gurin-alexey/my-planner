import React, { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import DatePicker from '../DatePicker'
import { useTaskStore } from '../../store/useTaskStore'
import { Task, Tag } from '../../types'

interface TaskDetailProps {
    mode?: 'panel' | 'modal';
}

const TaskDetail: React.FC<TaskDetailProps> = ({ mode = 'panel' }) => {
    // Store
    const tasks = useTaskStore(state => state.tasks)
    const allLists = useTaskStore(state => state.allLists)
    const allTags = useTaskStore(state => state.allTags)
    const currentTaskId = useTaskStore(state => state.currentTaskId)
    const updateTask = useTaskStore(state => state.updateTask)
    const deleteTask = useTaskStore(state => state.deleteTask)
    const closeTaskDetail = useTaskStore(state => state.closeTaskDetail)
    const addTask = useTaskStore(state => state.addTask)
    const toggleTask = useTaskStore(state => state.toggleTask)

    // Derived
    const task = tasks.find(t => t.id === currentTaskId)
    const isModal = mode === 'modal'

    // Local Form State
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [dueDate, setDueDate] = useState<Date | null>(null)
    const [endDate, setEndDate] = useState<Date | null>(null)
    const [dueTime, setDueTime] = useState<string | null>(null)
    const [dueTimeEnd, setDueTimeEnd] = useState<string | null>(null)
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('low')
    const [listId, setListId] = useState<string | null>(null)
    const [isProject, setIsProject] = useState(false)
    const [selectedTags, setSelectedTags] = useState<Tag[]>([])

    // Subtasks
    const taskSubtasks = tasks
        .filter(t => t.parent_id === currentTaskId)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))

    const [showDatePicker, setShowDatePicker] = useState(false)
    const [showProjectSelect, setShowProjectSelect] = useState(false)
    const [showTagSelect, setShowTagSelect] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isAiLoading, setIsAiLoading] = useState(false)

    // Refs
    const datePickerRef = useRef<HTMLDivElement>(null)
    const datePickerBtnRef = useRef<HTMLButtonElement>(null)
    const projectSelectRef = useRef<HTMLDivElement>(null)
    const projectSelectBtnRef = useRef<HTMLButtonElement>(null)
    const tagSelectRef = useRef<HTMLDivElement>(null)
    const tagSelectBtnRef = useRef<HTMLButtonElement>(null)

    // Init State from Task
    useEffect(() => {
        if (task) {
            setTitle(task.title || '')
            setDescription(task.description || '')
            setDueDate(task.due_date ? new Date(task.due_date) : null)
            setEndDate(task.end_date ? new Date(task.end_date) : null)
            setDueTime(task.due_time || null)
            setDueTimeEnd(task.end_time || null)
            setPriority(task.priority || 'low')
            setListId(task.list_id || null)
            setIsProject(task.is_project || false)
            setSelectedTags(task.tags || [])
        }
    }, [task?.id, task?.due_date, task?.due_time, task?.end_date, task?.end_time])

    // Auto-Save Logic
    useEffect(() => {
        if (!task) return

        const timer = setTimeout(() => {
            const payload: Partial<Task> = {
                title,
                description,
                due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
                end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
                due_time: dueTime,
                end_time: dueTimeEnd,
                priority,
                list_id: listId,
                is_project: isProject
            }

            const currentTagsIds = selectedTags.map(t => t.id).sort().join(',')
            const originalTagsIds = (task.tags || []).map(t => t.id).sort().join(',')
            const tagsChanged = currentTagsIds !== originalTagsIds

            const valuesChanged =
                (payload.title !== (task.title || '')) ||
                (payload.description !== (task.description || '')) ||
                (payload.due_date !== (task.due_date || null)) ||
                (payload.end_date !== (task.end_date || null)) ||
                (payload.due_time !== (task.due_time || null)) ||
                (payload.end_time !== (task.end_time || null)) ||
                (payload.priority !== (task.priority || 'low')) ||
                (payload.list_id !== (task.list_id || null)) ||
                (payload.is_project !== (task.is_project || false))

            if (valuesChanged || tagsChanged) {
                setIsSaving(true)
                updateTask(task.id, payload, selectedTags).then(() => {
                    setIsSaving(false)
                })
            }
        }, 1000)

        return () => clearTimeout(timer)
    }, [title, description, dueDate, endDate, dueTime, dueTimeEnd, priority, listId, isProject, selectedTags, task, updateTask])

    // Handlers
    const handleAddSubtask = async () => {
        if (!task) return
        const newTask = await addTask('Новая подзадача', null) // Pass null as list_id initially or task.list_id? 
        // Logic: subtask should probably belong to same list?
        // useTaskStore says: addTask(title, list_id)

        if (newTask) {
            // Assuming onDropTaskOnTask sets the parent_id correctly
            useTaskStore.getState().onDropTaskOnTask(newTask.id, task.id)
        }
    }

    const handleToggleSubtask = (subId: string) => {
        const sub = taskSubtasks.find(s => s.id === subId)
        if (sub) {
            // toggleTask updates status. 
            // Logic: if done -> todo, else -> done
            toggleTask(subId, sub.status === 'done' ? 'todo' : 'done')
        }
    }

    const handleDeleteSubtask = (subId: string) => {
        deleteTask(subId)
    }

    const handleSubtaskChange = (subId: string, newTitle: string) => {
        updateTask(subId, { title: newTitle })
    }

    const handleAiSuggest = async () => {
        setIsAiLoading(true)
        try {
            setTimeout(() => setIsAiLoading(false), 1000)
        } catch (e) { setIsAiLoading(false) }
    }

    const handleMoveTask = (targetListId: string | null) => {
        setListId(targetListId)
        setShowProjectSelect(false)
    }

    if (!task) return null;

    return (
        <div className={`flex flex-col h-full bg-white ${isModal ? 'rounded-t-[40px] sm:rounded-3xl' : ''}`}>
            {isModal && <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2 shrink-0 sm:hidden"></div>}

            {/* Title Section */}
            <div className={`px-8 pt-4 pb-2 ${isModal ? 'sm:px-12' : 'px-6'} border-b border-slate-50 relative`}>
                {isSaving && (
                    <div className="absolute top-1 right-8 text-[9px] text-indigo-400 animate-pulse font-black uppercase tracking-widest">
                        Сохранение...
                    </div>
                )}
                <textarea
                    placeholder="Что нужно сделать?"
                    className={`w-full ${isModal ? 'text-2xl sm:text-3xl' : 'text-xl'} font-bold placeholder:text-slate-100 border-none focus:ring-0 p-0 mb-2 mt-2 text-black outline-none bg-transparent leading-tight resize-none`}
                    value={title}
                    onChange={e => {
                        setTitle(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    rows={1}
                    style={{ height: 'auto' }}
                    ref={el => {
                        if (el) {
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                        }
                    }}
                />
            </div>

            {/* Main Content Area */}
            <div className={`flex-1 p-8 ${isModal ? 'sm:px-12' : 'p-6'} overflow-y-auto no-scrollbar`}>
                <textarea
                    placeholder="Детали задачи..."
                    className="w-full text-[15px] text-slate-500 placeholder:text-slate-200 border-none focus:ring-0 p-0 resize-none h-32 outline-none mb-8 leading-relaxed bg-transparent"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                />

                {/* Subtasks Section */}
                <div className="mb-8">
                    <div className="space-y-3">
                        {taskSubtasks.map(st => (
                            <div key={st.id} className="flex items-start gap-3 group">
                                <button
                                    onClick={() => handleToggleSubtask(st.id)}
                                    className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition ${st.status === 'done' ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 hover:border-indigo-400'}`}
                                >
                                    {st.status === 'done' && <span className="text-xs">✓</span>}
                                </button>
                                <input
                                    type="text"
                                    value={st.title || ''}
                                    onChange={e => handleSubtaskChange(st.id, e.target.value)}
                                    placeholder="Подзадача..."
                                    className={`flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 outline-none ${st.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                                />
                                <button onClick={() => handleDeleteSubtask(st.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition px-2">×</button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleAddSubtask}
                        className="mt-4 flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-600 font-bold transition"
                    >
                        <span className="text-lg">+</span> Добавить подзадачу
                    </button>
                </div>

                {/* Action Buttons & Selectors */}
                <div className="space-y-8">
                    <div className="flex flex-col gap-6">
                        {showDatePicker && (
                            <div ref={datePickerRef} className="animate-in fade-in zoom-in-95 duration-200 flex justify-center mb-4">
                                <DatePicker
                                    dueDate={dueDate}
                                    setDueDate={setDueDate}
                                    endDate={endDate}
                                    setEndDate={setEndDate}
                                    dueTime={dueTime}
                                    setDueTime={setDueTime}
                                    dueTimeEnd={dueTimeEnd}
                                    setDueTimeEnd={setDueTimeEnd}
                                    duration={0}
                                    setDuration={() => { }}
                                    onClose={() => setShowDatePicker(false)}
                                    onSave={() => { }}
                                />
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                ref={datePickerBtnRef}
                                onClick={() => setShowDatePicker(!showDatePicker)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition ${dueDate ? 'bg-black border-black text-white' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                                📅 {dueDate ? new Date(dueDate).toLocaleDateString() : "Срок"}
                            </button>
                            <button
                                onClick={() => setPriority(priority === 'low' ? 'high' : 'low')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition ${priority === 'high' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                                {priority === 'high' ? '🚩 Срочно' : '🏁 Обычный'}
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <button
                                    ref={projectSelectBtnRef}
                                    onClick={() => { setShowProjectSelect(!showProjectSelect); setShowTagSelect(false); }}
                                    className={`w-full px-4 py-3 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${listId ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <span>📁</span>
                                    {listId ? allLists.find(l => l.id === listId)?.name : 'Список'}
                                    <span className="opacity-50 text-[10px] ml-1">▼</span>
                                </button>

                                {showProjectSelect && (
                                    <div ref={projectSelectRef} className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-50 max-h-60 overflow-y-auto transform origin-bottom animate-in zoom-in-95 duration-200">
                                        <button
                                            onClick={() => handleMoveTask(null)}
                                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2 text-slate-600"
                                        >
                                            <span>📥</span> Личное
                                        </button>
                                        {allLists.map(list => (
                                            <button
                                                key={list.id}
                                                onClick={() => handleMoveTask(list.id)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2 ${listId === list.id ? 'bg-slate-100 text-black' : 'text-slate-600'}`}
                                            >
                                                <span>{list.name.toUpperCase().includes('ЦЕЛИ') ? '⭐' : list.name.toUpperCase().includes('КУПИТЬ') ? '🛒' : '📁'}</span>
                                                {list.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="relative flex-1">
                                <button
                                    ref={tagSelectBtnRef}
                                    onClick={() => { setShowTagSelect(!showTagSelect); setShowProjectSelect(false); }}
                                    className={`w-full px-4 py-3 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${selectedTags && selectedTags.length > 0 ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <span>🏷️</span>
                                    {selectedTags && selectedTags.length > 0 ? `${selectedTags.length} меток` : 'Метки'}
                                    <span className="opacity-50 text-[10px] ml-1">▼</span>
                                </button>

                                {showTagSelect && (
                                    <div ref={tagSelectRef} className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-50 max-h-60 overflow-y-auto transform origin-bottom animate-in zoom-in-95 duration-200">
                                        {allTags.map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => {
                                                    const isSelected = selectedTags && selectedTags.some(t => t.id === tag.id)
                                                    if (isSelected) setSelectedTags(selectedTags.filter(t => t.id !== tag.id))
                                                    else setSelectedTags([...(selectedTags || []), tag])
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2 mb-1 ${selectedTags && selectedTags.some(t => t.id === tag.id) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
                                            >
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#cbd5e1' }}></div>
                                                {tag.name}
                                                {selectedTags && selectedTags.some(t => t.id === tag.id) && <span className="ml-auto text-[10px]">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 items-stretch">
                            <button
                                onClick={() => setIsProject(!isProject)}
                                className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl border text-xs font-bold transition ${isProject ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${isProject ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300'}`}>
                                    {isProject && <span className="text-[10px]">✓</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>🚀</span>
                                    <span>Проект</span>
                                </div>
                            </button>

                            <div className="flex gap-1 items-center">
                                <button
                                    onClick={handleAiSuggest}
                                    disabled={isAiLoading}
                                    className={`w-12 flex items-center justify-center rounded-xl border border-slate-200 transition ${isAiLoading ? 'opacity-50' : 'hover:bg-indigo-50 hover:text-indigo-600'}`}
                                    title="ИИ Помощник"
                                >
                                    {isAiLoading ? '⏳' : '✨'}
                                </button>
                                <button
                                    onClick={() => {
                                        if (window.confirm('Delete?')) {
                                            deleteTask(task.id)
                                            closeTaskDetail()
                                        }
                                    }}
                                    className="w-12 flex items-center justify-center rounded-xl border border-slate-200 text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
                                    title="Удалить задачу"
                                >
                                    <span className="text-lg">🗑️</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {!isModal && (
                <button
                    onClick={() => closeTaskDetail()}
                    className="absolute top-4 right-4 text-slate-300 hover:text-black p-1 transition"
                >
                    ✕
                </button>
            )}
        </div>
    )
}

export default TaskDetail
