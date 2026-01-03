import React, { useState } from 'react'
import { useTaskStore } from '../../store/useTaskStore'
import { Task } from '../../types'
import confetti from 'canvas-confetti'
import { useAutoAnimate } from '@formkit/auto-animate/react'

// Helper for animation
const AnimatedList = ({ children, className }: { children: React.ReactNode, className?: string }) => {
    const [ref] = useAutoAnimate<HTMLDivElement>()
    return <div ref={ref} className={className}>{children}</div>
}

const TaskList: React.FC = () => {
    // Store State
    const tasks = useTaskStore(state => state.tasks)
    const loading = useTaskStore(state => state.loading)
    const collapsedFolders = useTaskStore(state => state.collapsedFolders)
    const toggleFolder = useTaskStore(state => state.toggleFolder)
    const deleteTask = useTaskStore(state => state.deleteTask)

    // Touch Refs
    const touchStartX = React.useRef<number | null>(null)
    const touchStartY = React.useRef<number | null>(null)

    const draggedTaskId = useTaskStore(state => state.draggedTaskId)
    const setDraggedTaskId = useTaskStore(state => state.setDraggedTaskId)

    const editingTaskId = useTaskStore(state => state.editingTaskId)
    const setEditingTaskId = useTaskStore(state => state.setEditingTaskId)

    // Raw Data for local filtering
    const searchQuery = useTaskStore(state => state.searchQuery)
    const selectedListId = useTaskStore(state => state.selectedListId)
    const selectedTagId = useTaskStore(state => state.selectedTagId)
    const dateFilter = useTaskStore(state => state.dateFilter)
    const sortBy = useTaskStore(state => state.sortBy)
    const groupBy = useTaskStore(state => state.groupBy)
    const allLists = useTaskStore(state => state.allLists)

    // Derived Data (Memoized locally to avoid Store selector infinite loops)
    const sortedTasks = React.useMemo(() => {
        let filtered = [...tasks]

        // 1. Search
        if (searchQuery) {
            const lowQ = searchQuery.toLowerCase()
            filtered = filtered.filter(t => (t.title || '').toLowerCase().includes(lowQ))
        }

        // 2. Filters
        if (selectedListId) {
            filtered = filtered.filter(t => t.list_id === selectedListId)
        }
        if (selectedTagId) {
            filtered = filtered.filter(t => t.tags && t.tags.some(tag => tag.id === selectedTagId))
        }

        // 3. Date Filter
        if (dateFilter === 'today') {
            const todayStr = new Date().toISOString().split('T')[0]
            filtered = filtered.filter(t => t.due_date && t.due_date.startsWith(todayStr))
        } else if (dateFilter === 'tomorrow') {
            const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
            const tmrwStr = tmrw.toISOString().split('T')[0]
            filtered = filtered.filter(t => t.due_date && t.due_date.startsWith(tmrwStr))
        } else if (dateFilter === 'no-date') {
            filtered = filtered.filter(t => !t.due_date)
        }
        // 'all' includes everything

        // 4. Sorting
        filtered.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)) // Default

        if (sortBy === 'date') {
            filtered.sort((a, b) => new Date(a.due_date || '9999').getTime() - new Date(b.due_date || '9999').getTime())
        } else if (sortBy === 'alpha') {
            filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
        }

        return filtered
    }, [tasks, searchQuery, selectedListId, selectedTagId, dateFilter, sortBy])

    const groupedTasks = React.useMemo(() => {
        if (!groupBy || groupBy === 'none') {
            return [{ name: '', tasks: sortedTasks }]
        }

        if (groupBy === 'list') {
            const groups: { name: string, tasks: Task[] }[] = []
            // Tasks with List
            const listGroups = allLists.map(l => ({
                name: l.name,
                tasks: sortedTasks.filter(t => t.list_id === l.id)
            })).filter(g => g.tasks.length > 0)

            // Tasks without list
            const noListTasks = sortedTasks.filter(t => !t.list_id)
            if (noListTasks.length > 0) groups.push({ name: 'Inbox', tasks: noListTasks })

            return [...groups, ...listGroups]
        }
        return [{ name: '', tasks: sortedTasks }]
    }, [sortedTasks, groupBy, allLists])

    // Actions
    const onDropTaskOnTask = useTaskStore(state => state.onDropTaskOnTask)
    const onRemoveParent = useTaskStore(state => state.onRemoveParent)
    const toggleTask = useTaskStore(state => state.toggleTask)
    const openTaskDetail = useTaskStore(state => state.openTaskDetail)
    const onDropTaskReorder = useTaskStore(state => state.onDropTaskReorder)

    // Local UI State
    const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({})
    const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
    const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null)
    const [swipeTaskId, setSwipeTaskId] = useState<string | null>(null)
    const [swipeOffset, setSwipeOffset] = useState<number | null>(null)
    const [exitingTaskIds] = useState<string[]>([])

    // Handlers
    const onTouchStart = (e: React.TouchEvent, taskId: string) => {
        touchStartX.current = e.touches[0].clientX
        touchStartY.current = e.touches[0].clientY
        setSwipeTaskId(taskId as any) // Type hack if needed, or just string
        setSwipeOffset(0) // Start at 0
    }

    const onTouchMove = (e: React.TouchEvent) => {
        if (touchStartX.current === null) return
        const diffX = e.touches[0].clientX - touchStartX.current
        const diffY = e.touches[0].clientY - (touchStartY.current || 0)

        // Only swipe if horizontal movement is dominant
        if (Math.abs(diffX) > Math.abs(diffY)) {
            setSwipeOffset(diffX)
        }
    }

    const onTouchEnd = (e: React.TouchEvent, task: Task) => {
        if (swipeOffset && Math.abs(swipeOffset) > 100) {
            if (navigator.vibrate) navigator.vibrate(50)
            if (swipeOffset > 0) {
                // Right swipe -> Toggle
                handleTaskCompletion(e as any, task)
            } else {
                // Left swipe -> Delete
                if (window.confirm('Удалить задачу?')) {
                    deleteTask(task.id)
                }
            }
        }
        setSwipeTaskId(null)
        setSwipeOffset(null)
        touchStartX.current = null
        touchStartY.current = null
    }

    const handleContextMenu = (e: React.MouseEvent, _task: Task) => {
        e.preventDefault()
    }

    const handleTaskCompletion = (e: React.MouseEvent, task: Task) => {
        e.stopPropagation()
        if (task.status !== 'done') {
            confetti({
                particleCount: 60,
                spread: 70,
                origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight },
                colors: ['#6366f1', '#a855f7', '#ec4899'],
                disableForReducedMotion: true
            });
        }
        toggleTask(task.id, task.status)
    }

    if (loading && tasks.length === 0) {
        return <div className="text-center py-20 text-slate-300 text-sm">Обновление...</div>;
    }

    if (sortedTasks.length === 0) {
        return (
            <div className="py-24 flex flex-col items-center opacity-20">
                <span className="text-6xl mb-4">🎑</span>
                <p className="text-xs uppercase tracking-widest text-slate-500">Список пуст</p>
            </div>
        );
    }

    const renderTaskItem = (task: Task, group: { name: string, tasks: Task[] }) => {
        const hasSubtasks = group.tasks.some(st => st.parent_id === task.id);
        const isExpanded = expandedTaskIds[task.id];
        const isTaskDone = task.status === 'done';

        // Ensure task has tags array even if null
        const taskTags = task.tags || [];

        return (
            <div key={task.id} className="relative overflow-hidden">
                {/* Swipe Actions Background */}
                <div className={`absolute inset-y-0 left-0 bg-emerald-500 flex items-center pl-4 text-white font-bold text-[10px] uppercase tracking-widest transition-all duration-200 ${swipeTaskId === task.id && (swipeOffset || 0) > 0 ? 'opacity-100 w-full' : 'opacity-0 w-0'}`}>
                    Выполнить
                </div>
                <div className={`absolute inset-y-0 right-0 bg-rose-500 flex items-center justify-end pr-4 text-white font-bold text-[10px] uppercase tracking-widest transition-all duration-200 ${swipeTaskId === task.id && (swipeOffset || 0) < 0 ? 'opacity-100 w-full' : 'opacity-0 w-0'}`}>
                    Удалить
                </div>

                <div
                    style={{
                        transform: swipeTaskId === task.id ? `translateX(${swipeOffset}px)` : 'none',
                        transition: swipeTaskId === task.id ? 'none' : 'transform 0.2s ease-out'
                    }}
                    onTouchStart={(e) => onTouchStart(e, task.id)}
                    onTouchMove={onTouchMove}
                    onTouchEnd={(e) => onTouchEnd(e, task)}
                    className={`group flex items-center gap-0 min-h-[2.5rem] border-b border-slate-50 transition-all duration-700 ease-in-out relative hover:bg-slate-50 bg-white
            ${dragOverTaskId === task.id ? 'bg-slate-50/50' : ''}
            ${exitingTaskIds.includes(task.id) ? 'translate-y-24 opacity-0 scale-95 pointer-events-none' : ''}
          `}
                    onContextMenu={(e) => handleContextMenu(e, task)}
                    onDragOver={e => {
                        e.preventDefault();
                        if (draggedTaskId && String(draggedTaskId) !== String(task.id)) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const isTop = y < rect.height / 2;
                            setDragOverTaskId(task.id);
                            setDropPosition(isTop ? 'top' : 'bottom');
                        }
                    }}
                    onDragLeave={() => {
                        // setDragOverTaskId(null); // Keep commented or remove if causing flickering/loop
                        // setDropPosition(null);
                    }}
                    onDrop={e => {
                        e.stopPropagation();
                        const draggedId = e.dataTransfer.getData('taskId');
                        if (draggedId) {
                            if (dragOverTaskId && dropPosition) {
                                onDropTaskReorder(e, dragOverTaskId, dropPosition);
                            } else if (dragOverTaskId) {
                                onDropTaskOnTask(draggedId, task.id)
                            }
                        }
                        setDragOverTaskId(null);
                        setDropPosition(null);
                    }}
                    onClick={() => {
                        if (window.innerWidth >= 1024) return;
                        openTaskDetail(task, 'modal');
                    }}
                >
                    {dragOverTaskId === task.id && dropPosition && (
                        <div className={`absolute left-0 right-0 h-0.5 bg-indigo-500 z-30 rounded-full ${dropPosition === 'top' ? '-top-[1px]' : '-bottom-[1px]'}`}>
                            <div className="absolute left-0 -top-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white"></div>
                        </div>
                    )}
                    <div
                        draggable="true"
                        className={`opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-500 transition w-6 select-none flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing
            ${draggedTaskId && String(draggedTaskId) !== String(task.id) ? 'pointer-events-none' : ''}
          `}
                        onDragStart={(e) => {
                            e.dataTransfer.setData('taskId', task.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedTaskId(task.id);
                        }}
                        onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDropPosition(null);
                        }}
                    >⋮⋮</div>

                    {hasSubtasks ? (
                        <div onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTaskIds(prev => ({ ...prev, [task.id]: !prev[task.id] }));
                        }} className="w-4 h-full flex items-center justify-center cursor-pointer text-slate-300 hover:text-indigo-600 z-10">
                            <span className={`text-[8px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                        </div>
                    ) : (
                        <div className="w-4"></div>
                    )}

                    <div onClick={(e) => handleTaskCompletion(e, task)}
                        className={`w-5 h-5 rounded border transition-all duration-200 shrink-0 flex items-center justify-center cursor-pointer mr-2 ${isTaskDone ? 'bg-slate-200 border-slate-200' : 'border-slate-300 hover:border-slate-500'}`}>
                        {isTaskDone && <span className="text-[#666] text-[10px] font-bold">✓</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                        {editingTaskId === task.id ? (
                            <div className="text-slate-500 italic">Editing in Panel...</div>
                        ) : (
                            <p
                                className={`leading-tight transition cursor-text truncate ${isTaskDone ? 'line-through text-slate-400' : 'text-[#333]'} ${hasSubtasks || task.is_project ? 'uppercase font-bold tracking-wide text-xs' : 'text-[15px]'}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.innerWidth < 1024) {
                                        openTaskDetail(task, 'modal');
                                    } else {
                                        setEditingTaskId(task.id);
                                        openTaskDetail(task, 'panel');
                                    }
                                }}
                            >
                                {task.is_project && <span className="mr-1 inline-flex items-center justify-center w-5 h-5 bg-indigo-100 rounded text-[10px] grayscale-0">🚀</span>}
                                {(task.title || '').match(/https?:\/\/[^\s]+/) ? (
                                    <span dangerouslySetInnerHTML={{
                                        __html: (task.title || '').replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-indigo-600 hover:underline" onclick="event.stopPropagation()">$1</a>')
                                    }} />
                                ) : (task.title || '')}
                            </p>
                        )}

                        {(task.due_date || (taskTags.length > 0)) && (
                            <div className="flex flex-wrap gap-2 mt-1 text-[11px] font-medium text-slate-400 cursor-pointer" onClick={() => openTaskDetail(task, 'panel')}>
                                {task.due_date && <span>📅 {new Date(task.due_date).toLocaleDateString()}</span>}
                                {taskTags.map(t => <span key={t.id} className="text-slate-300">#{t.name}</span>)}
                            </div>
                        )}
                    </div>
                </div>

                {isExpanded && (
                    <div className="animate-in slide-in-from-top-1 duration-200">
                        {group.tasks.filter(st => st.parent_id && task.id && String(st.parent_id) === String(task.id)).map(subtask => {
                            const isSubtaskDone = subtask.status === 'done';
                            return (
                                <div key={subtask.id} className="relative overflow-hidden">
                                    <div className={`absolute inset-y-0 left-0 bg-emerald-500 flex items-center pl-10 text-white font-bold text-[8px] uppercase tracking-widest transition-all duration-200 ${swipeTaskId === subtask.id && (swipeOffset || 0) > 0 ? 'opacity-100 w-full' : 'opacity-0 w-0'}`}>
                                        Выполнить
                                    </div>
                                    <div className={`absolute inset-y-0 right-0 bg-rose-500 flex items-center justify-end pr-4 text-white font-bold text-[8px] uppercase tracking-widest transition-all duration-200 ${swipeTaskId === subtask.id && (swipeOffset || 0) < 0 ? 'opacity-100 w-full' : 'opacity-0 w-0'}`}>
                                        Delete
                                    </div>
                                    <div
                                        draggable="true"
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('taskId', subtask.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.currentTarget.classList.add('opacity-30');
                                            setDraggedTaskId(subtask.id);
                                        }}
                                        onDragEnd={(e: any) => {
                                            e.currentTarget.classList.remove('opacity-30');
                                            setDraggedTaskId(null);
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.innerWidth < 1024) {
                                                openTaskDetail(subtask, 'modal');
                                            } else {
                                                openTaskDetail(subtask, 'panel');
                                            }
                                        }}
                                        onContextMenu={(e) => handleContextMenu(e, subtask)}
                                        onTouchStart={(e) => onTouchStart(e, subtask.id)}
                                        onTouchMove={onTouchMove}
                                        onTouchEnd={(e) => onTouchEnd(e, subtask)}
                                        style={{
                                            transform: swipeTaskId === subtask.id ? `translateX(${swipeOffset}px)` : 'none',
                                            transition: swipeTaskId === subtask.id ? 'none' : 'transform 0.2s ease-out'
                                        }}
                                        className={`group flex items-start gap-2 py-2 border-b border-slate-50/50 cursor-pointer hover:bg-slate-50/30 transition-colors ml-8 relative bg-white
                    ${dragOverTaskId === subtask.id ? 'bg-slate-50/50' : ''}
                  `}
                                        onDragOver={e => {
                                            e.preventDefault();
                                            if (draggedTaskId && String(draggedTaskId) !== String(subtask.id)) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const y = e.clientY - rect.top;
                                                const isTop = y < rect.height / 2;
                                                setDragOverTaskId(subtask.id);
                                                setDropPosition(isTop ? 'top' : 'bottom');
                                            }
                                        }}
                                        onDragLeave={() => {
                                            setDragOverTaskId(null);
                                            setDropPosition(null);
                                        }}
                                        onDrop={e => {
                                            e.stopPropagation();
                                            const draggedId = e.dataTransfer.getData('taskId');
                                            if (draggedId && dragOverTaskId && dropPosition) {
                                                onDropTaskReorder(e, dragOverTaskId, dropPosition);
                                            } else if (draggedId) {
                                                onDropTaskOnTask(draggedId, subtask.id);
                                            }
                                            setDragOverTaskId(null);
                                            setDropPosition(null);
                                        }}
                                    >
                                        {dragOverTaskId === subtask.id && dropPosition && (
                                            <div className={`absolute left-0 right-0 h-0.5 bg-indigo-500 z-30 rounded-full ${dropPosition === 'top' ? '-top-[1px]' : '-bottom-[1px]'}`}>
                                                <div className="absolute left-8 -top-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white"></div>
                                            </div>
                                        )}
                                        <div
                                            draggable="true"
                                            className={`opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-500 transition px-1 w-4 select-none flex items-center justify-center h-full pt-0.5
                      ${draggedTaskId && String(draggedTaskId) !== String(subtask.id) ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}
                    `}
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('taskId', subtask.id);
                                                e.dataTransfer.effectAllowed = 'move';
                                                setDraggedTaskId(subtask.id);
                                                e.stopPropagation();
                                            }}
                                            onDragEnd={() => {
                                                setDraggedTaskId(null);
                                                setDragOverTaskId(null);
                                                setDropPosition(null);
                                            }}
                                        >⋮⋮</div>

                                        <div onClick={(e) => { e.stopPropagation(); toggleTask(subtask.id, subtask.status); }}
                                            className={`mt-0.5 w-4 h-4 rounded border transition-all duration-200 shrink-0 flex items-center justify-center ${isSubtaskDone ? 'bg-slate-100 border-slate-100' : 'border-slate-200 hover:border-slate-400'}`}>
                                            {isSubtaskDone && <span className="text-slate-400 text-[8px] font-bold">✓</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm leading-tight transition truncate ${isSubtaskDone ? 'line-through text-slate-300' : 'text-slate-600'}`}>
                                                {subtask.title}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
                const taskId = e.dataTransfer.getData('taskId');
                if (taskId) onRemoveParent(taskId);
            }}>

            {groupedTasks.map((group, gIdx) => {
                const isTopLevel = (t: Task) => (!t.parent_id || !group.tasks.some(pt => pt.id === t.parent_id));
                const activeTasks = group.tasks.filter(t => t.status !== 'done' && isTopLevel(t));
                const completedTasks = group.tasks.filter(t => t.status === 'done' && isTopLevel(t));
                const groupKey = `completed-${gIdx}`;
                const isCompletedOpen = collapsedFolders[groupKey];

                return (
                    <div key={gIdx} className="space-y-1">
                        {group.name && (
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-[1px] flex-1 bg-slate-100"></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{group.name}</span>
                                <div className="h-[1px] flex-1 bg-slate-100"></div>
                            </div>
                        )}

                        {/* ACTIVE - ANIMATED */}
                        <AnimatedList className="space-y-0">
                            {activeTasks.map(t => renderTaskItem(t, group))}
                        </AnimatedList>

                        {/* COMPLETED SECTION */}
                        {completedTasks.length > 0 && (
                            <div className="mt-auto pt-4 flex flex-col relative">
                                {isCompletedOpen && (
                                    <AnimatedList className="space-y-1 mb-2 pl-0 opacity-70">
                                        {completedTasks.map(t => renderTaskItem(t, group))}
                                    </AnimatedList>
                                )}

                                <button
                                    onClick={() => toggleFolder(groupKey)}
                                    className="sticky bottom-0 z-10 w-full bg-white/90 backdrop-blur-sm border-t border-slate-50 flex items-center justify-center gap-2 cursor-pointer select-none text-slate-400 hover:text-indigo-600 transition py-3 text-[10px] font-bold uppercase tracking-widest outline-none shadow-sm"
                                >
                                    <span className={`transition-transform duration-200 text-[10px] ${isCompletedOpen ? 'rotate-180' : ''}`}>▼</span>
                                    <span>{isCompletedOpen ? 'Скрыть выполненные' : 'Показать выполненные'}</span>
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500">{completedTasks.length}</span>
                                </button>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    );
};

export default TaskList;
