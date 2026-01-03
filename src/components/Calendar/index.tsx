import React, { useEffect, useState, useRef } from 'react'
import {
    format,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isToday,
    addDays,
    parseISO
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTaskStore } from '../../store/useTaskStore'
import { useUserSettings } from '../../hooks/useUserSettings'
import { Task } from '../../types'

interface CalendarViewProps {
    calendarDays?: number
}

interface ResizingState {
    id: string
    startY: number
    startDuration: number
    currentDuration: number
}

interface MovingState {
    id: string
    startY: number
    currentY: number
    startX: number
    currentX: number
}

const CalendarView: React.FC<CalendarViewProps> = () => {
    // Store & Settings
    const allTasks = useTaskStore(state => state.tasks)
    const tasks = React.useMemo(() => {
        return [...allTasks].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    }, [allTasks])

    const [viewMode, setViewMode] = useState<'day' | '3days' | 'week'>('week')
    const daysToShow = viewMode === 'day' ? 1 : viewMode === '3days' ? 3 : 7

    const currentDate = useTaskStore(state => state.calendarDate)
    const openTaskDetail = useTaskStore(state => state.openTaskDetail)
    const onDropTaskOnCalendar = useTaskStore(state => state.onDropTaskOnCalendar)
    const updateTask = useTaskStore(state => state.updateTask)
    const draggedTaskId = useTaskStore(state => state.draggedTaskId)
    const setDraggedTaskId = useTaskStore(state => state.setDraggedTaskId)
    const saveTask = useTaskStore(state => state.saveTask)
    const setIsSidebarOpen = useTaskStore(state => state.setIsSidebarOpen)

    // UI Settings
    // @ts-ignore: useUserSettings is JS
    const {
        hourHeight, setHourHeight,
        isNightHidden,
        workingStart, workingEnd
    } = useUserSettings()

    // Local Interaction State
    const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)
    const [now, setNow] = useState(new Date())
    const [resizingTaskState, setResizingTaskState] = useState<ResizingState | null>(null)
    const [movingTaskState, setMovingTaskState] = useState<MovingState | null>(null)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

    const gridRef = useRef<HTMLDivElement>(null)

    // Touch & Long Press Logic
    const longPressTimer = useRef<any>(null)
    const lastTapRef = useRef<number>(0)

    // Touch/Pinch Logic
    const pinchDistRef = useRef<number | null>(null)
    const handlePinchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const d = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            )
            pinchDistRef.current = d
        }
    }
    const handlePinchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchDistRef.current) {
            const d = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            )
            const diff = d - pinchDistRef.current
            if (Math.abs(diff) > 5) {
                const scale = diff > 0 ? 2 : -2
                setHourHeight((prev: number) => Math.max(20, Math.min(200, prev + scale)))
                pinchDistRef.current = d
            }
        }
    }
    const handlePinchEnd = () => { pinchDistRef.current = null }

    // Wheel Zoom
    useEffect(() => {
        const el = gridRef.current
        if (!el) return
        const handleNativeWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault()
                const delta = e.deltaY > 0 ? -1 : 1
                setHourHeight((prev: number) => Math.max(20, Math.min(200, prev + delta * 5)))
            }
        }
        el.addEventListener('wheel', handleNativeWheel, { passive: false })
        return () => el.removeEventListener('wheel', handleNativeWheel)
    }, [setHourHeight])

    // Current Time Timer
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Resize & Move Logic
    const handleTaskResizeStart = (e: React.MouseEvent | React.TouchEvent, task: Task) => {
        e.stopPropagation()
        let clientY: number
        if ('touches' in e) {
            clientY = e.touches[0].clientY
        } else {
            clientY = (e as React.MouseEvent).clientY
        }

        const [h_s, m_s] = (task.due_time || '00:00').split(':').map(Number)
        const [h_e, m_e] = (task.end_time || '23:59:59').split(':').map(Number)
        const startMin = h_s * 60 + m_s
        const endMin = h_e * 60 + m_e
        const duration = endMin - startMin

        setResizingTaskState({
            id: task.id,
            startY: clientY,
            startDuration: duration,
            currentDuration: duration
        })
    }

    // Global listeners for resize/move
    useEffect(() => {
        const handleWindowMove = (e: MouseEvent | TouchEvent) => {
            if (!resizingTaskState && !movingTaskState) return

            let clientY: number
            let clientX: number
            if ('touches' in e && e.touches.length > 0) {
                clientY = e.touches[0].clientY
                clientX = e.touches[0].clientX
            } else if ('clientY' in e) {
                clientY = (e as MouseEvent).clientY
                clientX = (e as MouseEvent).clientX
            } else {
                return
            }

            if (resizingTaskState) {
                e.preventDefault()
                const deltaY = clientY - resizingTaskState.startY
                const minutesDelta = deltaY / (hourHeight / 60)
                const newDuration = Math.max(15, resizingTaskState.startDuration + minutesDelta)
                setResizingTaskState(prev => prev ? ({ ...prev, currentDuration: newDuration }) : null)
            }

            if (movingTaskState) {
                e.preventDefault()
                setMovingTaskState(prev => prev ? ({ ...prev, currentY: clientY, currentX: clientX }) : null)

                // Try to find the slot under finger for highlight
                const task = tasks.find(t => t.id === movingTaskState.id)
                const gridRect = gridRef.current?.getBoundingClientRect()
                if (task && gridRect) {
                    const relativeX = clientX - gridRect.left
                    const colWidth = gridRect.width / daysToShow
                    const dayOffset = Math.floor(relativeX / colWidth)

                    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
                    const targetDay = addDays(startDate, dayOffset)
                    const dayStr = format(targetDay, 'yyyy-MM-dd')

                    const relativeY = clientY - gridRect.top + gridRef.current!.scrollTop
                    const hour = Math.floor(relativeY / hourHeight)
                    const slotId = `slot-${dayStr}-${hour}-0`
                    if (dragOverSlot !== slotId) setDragOverSlot(slotId)
                }
            }
        }

        const handleWindowUp = (_e: MouseEvent | TouchEvent) => {
            setDragOverSlot(null) // Clear highlight

            if (resizingTaskState) {
                const task = tasks.find((t: Task) => t.id === resizingTaskState.id)
                if (task) {
                    const [h_s, m_s] = (task.due_time || '00:00').split(':').map(Number)
                    const startMin = h_s * 60 + m_s
                    const newEndMin = Math.max(startMin + 15, startMin + resizingTaskState.currentDuration)
                    const newEndH = Math.min(23, Math.floor(newEndMin / 60))
                    const newEndM = Math.floor(newEndMin % 60)
                    const endTimeStr = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}:00`
                    updateTask(task.id, { end_time: endTimeStr, end_date: task.due_date }, task.tags || [])
                }
                setResizingTaskState(null)
            }

            if (movingTaskState) {
                const task = tasks.find((t: Task) => t.id === movingTaskState.id)
                if (task) {
                    const gridRect = gridRef.current?.getBoundingClientRect()
                    const allDayRow = document.getElementById('all-day-row')?.getBoundingClientRect()

                    // Check if dropped in All-Day section
                    const isAllDayDrop = allDayRow && movingTaskState.currentY >= allDayRow.top && movingTaskState.currentY <= allDayRow.bottom

                    let dayChange = 0
                    if (gridRect) {
                        const colWidth = gridRect.width / daysToShow
                        const deltaX = movingTaskState.currentX - movingTaskState.startX
                        dayChange = Math.round(deltaX / colWidth)
                    }

                    // Calculate new date
                    const currentDueDate = parseISO(task.due_date!)
                    const newDateStr = format(addDays(currentDueDate, dayChange), 'yyyy-MM-dd')

                    if (isAllDayDrop) {
                        // Move to All Day (remove time)
                        updateTask(task.id, {
                            due_time: null,
                            end_time: null,
                            due_date: newDateStr,
                            end_date: newDateStr
                        }, task.tags || [])
                    } else {
                        // Regular time move
                        const deltaY = movingTaskState.currentY - movingTaskState.startY
                        const minutesDelta = Math.round(deltaY / (hourHeight / 60) / 15) * 15

                        const [h_s, m_s] = (task.due_time || '00:00').split(':').map(Number)
                        const [h_e, m_e] = (task.end_time || '23:59:59').split(':').map(Number)
                        const startMin = h_s * 60 + m_s
                        const duration = (h_e * 60 + m_e) - startMin

                        const newStartMin = Math.max(0, Math.min(1440 - duration, startMin + minutesDelta))
                        const newEndMin = newStartMin + duration

                        const startTimeStr = `${String(Math.floor(newStartMin / 60)).padStart(2, '0')}:${String(newStartMin % 60).padStart(2, '0')}:00`
                        const endTimeStr = `${String(Math.min(23, Math.floor(newEndMin / 60))).padStart(2, '0')}:${String(newEndMin % 60).padStart(2, '0')}:00`

                        updateTask(task.id, {
                            due_time: startTimeStr,
                            end_time: endTimeStr,
                            due_date: newDateStr,
                            end_date: newDateStr
                        }, task.tags || [])
                    }
                }
                setMovingTaskState(null)
            }
        }

        if (resizingTaskState || movingTaskState) {
            window.addEventListener('mousemove', handleWindowMove, { passive: false })
            window.addEventListener('touchmove', handleWindowMove, { passive: false })
            window.addEventListener('mouseup', handleWindowUp)
            window.addEventListener('touchend', handleWindowUp)
        }
        return () => {
            window.removeEventListener('mousemove', handleWindowMove)
            window.removeEventListener('touchmove', handleWindowMove)
            window.removeEventListener('mouseup', handleWindowUp)
            window.removeEventListener('touchend', handleWindowUp)
        }
    }, [resizingTaskState, movingTaskState, hourHeight, tasks, updateTask, daysToShow, currentDate, dragOverSlot])

    // Touch Handlers for Tasks (Move)
    const handleCalendarTaskTouchStart = (e: React.TouchEvent, task: Task) => {
        const touch = e.touches[0];
        const clientY = touch.clientY;
        const clientX = touch.clientX;

        if (longPressTimer.current) clearTimeout(longPressTimer.current);

        longPressTimer.current = setTimeout(() => {
            // @ts-ignore
            if (window.navigator.vibrate) window.navigator.vibrate(50);
            setMovingTaskState({
                id: task.id,
                startY: clientY,
                currentY: clientY,
                startX: clientX,
                currentX: clientX
            });
            longPressTimer.current = null;
        }, 400);
    }

    const handleCalendarTaskTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }

    const handleTaskClick = (e: React.MouseEvent | React.TouchEvent, task: Task) => {
        e.stopPropagation()
        const now = Date.now()
        const DOUBLE_TAP_DELAY = 300

        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // Double tap - Open Detail and show sidebar
            openTaskDetail(task, 'panel')
            setIsSidebarOpen(true)
            setSelectedTaskId(task.id)
            lastTapRef.current = 0
        } else {
            // Single tap - Just select
            setSelectedTaskId(task.id)
            lastTapRef.current = now
        }
    }

    const handleSlotClick = (date: Date, hour: number) => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;

        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            if (movingTaskState || resizingTaskState) return;

            const dueTime = `${hour.toString().padStart(2, '0')}:00`
            const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`

            const title = prompt('Название новой задачи:')
            if (title && title.trim()) {
                saveTask(title.trim(), {
                    due_date: format(date, 'yyyy-MM-dd'),
                    due_time: dueTime,
                    end_time: endTime,
                    status: 'todo'
                })
            }
            lastTapRef.current = 0;
        } else {
            lastTapRef.current = now;
        }
    }

    const safeTasks = Array.isArray(tasks) ? tasks : []

    const renderWeek = () => {
        let startDate: Date
        let daysList: Date[]
        if (daysToShow === 7) {
            startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
            daysList = eachDayOfInterval({ start: startDate, end: endOfWeek(startDate, { weekStartsOn: 1 }) })
        } else {
            startDate = currentDate
            daysList = Array.from({ length: daysToShow || 7 }, (_, i) => addDays(startDate, i))
        }

        const allHours = Array.from({ length: 24 }, (_, i) => i)
        const hours = isNightHidden && workingStart !== undefined && workingEnd !== undefined
            ? allHours.filter(h => h >= workingStart && h < workingEnd)
            : allHours

        const handleGridDragOver = (e: React.DragEvent, day: Date) => {
            e.preventDefault()
            const rect = e.currentTarget.getBoundingClientRect()
            const y = e.clientY - rect.top
            const ratio = y / rect.height
            const totalMinutes = ratio * 1440
            const snappedMinutes = Math.floor(totalMinutes / 30) * 30
            const hh = Math.floor(snappedMinutes / 60)
            const mm = snappedMinutes % 60

            if (hh >= 0 && hh < 24) {
                const slotId = `slot-${format(day, 'yyyy-MM-dd')}-${hh}-${mm}`
                if (dragOverSlot !== slotId) setDragOverSlot(slotId)
            }
        }

        const handleGridDrop = (e: React.DragEvent, day: Date) => {
            e.preventDefault()
            setDragOverSlot(null)
            const taskId = e.dataTransfer.getData('taskId')
            if (!taskId) return

            const rect = e.currentTarget.getBoundingClientRect()
            const y = e.clientY - rect.top
            const ratio = y / rect.height
            const totalMinutes = ratio * 1440
            const snappedMinutes = Math.floor(totalMinutes / 30) * 30
            const hh = Math.floor(snappedMinutes / 60)
            const mm = snappedMinutes % 60

            if (hh >= 0 && hh < 24) {
                const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
                onDropTaskOnCalendar(taskId, day, timeStr)
            }
        }

        return (
            <div className="flex-1 flex flex-col min-h-0 relative">
                {/* View Switcher */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[150] flex bg-white/90 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-slate-100/50 md:top-4">
                    {[
                        { id: 'day', label: '1 день' },
                        { id: '3days', label: '3 дня' },
                        { id: 'week', label: 'Неделя' }
                    ].map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => setViewMode(mode.id as any)}
                            className={`px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${viewMode === mode.id
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'text-slate-400 hover:bg-slate-50'
                                }`}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
                <div className={`${daysToShow === 1 ? 'hidden md:grid' : 'grid'} border-b border-slate-100 bg-slate-50/30 shrink-0 pr-[10px]`} style={{ gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)` }}>
                    <div className="border-r border-slate-100"></div>
                    {daysList.map((day, i) => (
                        <div key={i} className="flex flex-col items-center py-2 border-r border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(day, 'EE', { locale: ru })}</span>
                            <span className={`text-sm font-black w-7 h-7 flex items-center justify-center rounded-full mt-1 ${isToday(day) ? 'bg-indigo-600 text-white' : 'text-slate-800'}`}>
                                {format(day, 'd')}
                            </span>
                        </div>
                    ))}
                </div>

                <div id="all-day-row" className={`grid bg-slate-50/30 border-b border-slate-100 min-h-[40px] z-[60] pr-[10px]`} style={{ gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)` }}>
                    <div className="flex items-center justify-center border-r border-slate-100 py-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase vertical-text">Весь день</span>
                    </div>
                    {daysList.map((day, i) => {
                        const dayStr = format(day, 'yyyy-MM-dd')
                        const allDayTasks = safeTasks.filter((t: Task) => {
                            if (!t.due_date) return false
                            const startStr = t.due_date.split('T')[0]
                            const endStr = (t.end_date || t.due_date).split('T')[0]
                            const isWithinDays = dayStr >= startStr && dayStr <= endStr
                            return isWithinDays && !t.due_time
                        })
                        const slotId = `all-day-${format(day, 'yyyy-MM-dd')}`
                        return (
                            <div
                                key={i}
                                onDragOver={e => e.preventDefault()}
                                onDragEnter={() => setDragOverSlot(slotId)}
                                onDragLeave={() => setDragOverSlot(null)}
                                onDrop={e => {
                                    const taskId = e.dataTransfer.getData('taskId')
                                    if (taskId) onDropTaskOnCalendar(taskId, day, 'all-day')
                                    setDragOverSlot(null)
                                }}
                                className={`border-r border-slate-100 p-2 min-h-[50px] bg-slate-50/10 transition-colors min-w-0 overflow-hidden ${dragOverSlot === slotId ? 'bg-indigo-50 ring-2 ring-indigo-200 ring-inset opacity-100 z-10' : ''}`}
                            >
                                <div className="space-y-1">
                                    {allDayTasks.map((task: Task) => (
                                        <div key={task.id}
                                            draggable="true"
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('taskId', task.id);
                                                e.dataTransfer.effectAllowed = 'move';
                                                setDraggedTaskId(task.id);
                                            }}
                                            onDragEnd={() => setDraggedTaskId(null)}
                                            onClick={(e) => handleTaskClick(e, task)}
                                            onDoubleClick={(e) => { e.stopPropagation(); openTaskDetail(task, 'panel'); setSelectedTaskId(task.id); }}
                                            onTouchStart={(e) => handleCalendarTaskTouchStart(e, task)}
                                            onTouchEnd={handleCalendarTaskTouchEnd}
                                            className={`text-[10px] p-1.5 w-full block truncate rounded-lg cursor-pointer shadow-sm ${task.status === 'done' ? 'bg-slate-100 text-slate-300' : 'bg-white border border-slate-100 text-slate-700'}`}>
                                            {task.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div ref={gridRef} className="flex-1 overflow-y-scroll custom-scrollbar relative" onTouchStart={handlePinchStart} onTouchMove={handlePinchMove} onTouchEnd={handlePinchEnd}>
                    <div id="week-view-container" className={`grid bg-white relative`} style={{ height: `${hourHeight * hours.length}px`, gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)` }}>


                        <div className="border-r border-slate-100">
                            {hours.map(h => (
                                <div key={h} className="border-b border-slate-50 relative" style={{ height: `${hourHeight}px` }}>
                                    <span className="absolute -top-2 right-2 text-[10px] font-bold text-slate-300">{format(new Date().setHours(h, 0), 'HH:00')}</span>
                                </div>
                            ))}
                        </div>

                        {(() => {
                            const mins = now.getHours() * 60 + now.getMinutes()
                            if (isNightHidden && (now.getHours() < workingStart || now.getHours() >= workingEnd)) return null
                            const dayMinutes = isNightHidden ? (now.getHours() - workingStart) * 60 + now.getMinutes() : mins
                            const totalDisplayMinutes = hours.length * 60
                            const topPct = (dayMinutes / totalDisplayMinutes) * 100

                            return (
                                <div className="absolute left-0 right-0 flex items-center z-40 pointer-events-none" style={{ top: `${topPct}%` }}>
                                    <div className="w-[60px] flex justify-end pr-1">
                                        <div className="text-[8px] font-black text-red-500 bg-white px-1 rounded shadow-sm">
                                            {format(now, 'HH:mm')}
                                        </div>
                                    </div>
                                    <div className="flex-1 h-[1.5px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
                                </div>
                            )
                        })()}

                        {daysList.map((day, i) => {
                            const dayStr = format(day, 'yyyy-MM-dd')
                            const dayTasks = safeTasks.filter((t: Task) => {
                                if (movingTaskState && movingTaskState.id === t.id) {
                                    return dayStr === t.due_date?.split('T')[0]
                                }
                                if (!t.due_date || !t.due_time) return false
                                const startStr = t.due_date.split('T')[0]
                                const endStr = (t.end_date || t.due_date).split('T')[0]
                                return dayStr >= startStr && dayStr <= endStr
                            })

                            return (
                                <div
                                    key={i}
                                    className="relative border-r border-slate-100 h-full"
                                    onDragOver={(e) => handleGridDragOver(e, day)}
                                    onDragLeave={() => setDragOverSlot(null)}
                                    onDrop={(e) => handleGridDrop(e, day)}
                                >
                                    <div className="absolute inset-0">
                                        {hours.map(h => (
                                            <div
                                                key={h}
                                                className="border-b border-slate-50 relative hover:bg-slate-50/50 transition-colors cursor-crosshair group-grid"
                                                style={{ height: `${hourHeight}px` }}
                                                onClick={() => handleSlotClick(day, h)}
                                                onDoubleClick={() => {
                                                    const dueTime = `${h.toString().padStart(2, '0')}:00`
                                                    const endTime = `${(h + 1).toString().padStart(2, '0')}:00`
                                                    const title = prompt('Название новой задачи:')
                                                    if (title && title.trim()) {
                                                        saveTask(title.trim(), {
                                                            due_date: format(day, 'yyyy-MM-dd'),
                                                            due_time: dueTime,
                                                            end_time: endTime,
                                                            status: 'todo'
                                                        })
                                                    }
                                                }}
                                            >
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                                                    <span className="text-[10px] font-bold text-indigo-300">++ Дважды для задачи</span>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Drag Highlight Area */}
                                        {dragOverSlot?.startsWith(`slot-${dayStr}`) && (() => {
                                            const parts = dragOverSlot.split('-');
                                            const hh = parseInt(parts[4]);
                                            const mm = parseInt(parts[5]);

                                            const dTask = tasks.find((t: Task) => String(t.id) === String(draggedTaskId || movingTaskState?.id));
                                            let duration = 30;
                                            if (dTask && dTask.due_time && dTask.end_time) {
                                                const [hs, ms] = dTask.due_time.split(':').map(Number);
                                                const [he, me] = dTask.end_time.split(':').map(Number);
                                                duration = (he * 60 + me) - (hs * 60 + ms);
                                            }
                                            if (duration < 15) duration = 30;

                                            const displayMinutes = isNightHidden ? (hh - workingStart) * 60 + mm : hh * 60 + mm;
                                            const totalDisplayMinutes = hours.length * 60;
                                            const topPct = (displayMinutes / totalDisplayMinutes) * 100;
                                            const heightPct = (duration / totalDisplayMinutes) * 100;

                                            return (
                                                <div
                                                    className="absolute left-1 right-1 bg-indigo-500/10 border-2 border-indigo-500/30 border-dashed rounded-xl z-0 transition-all duration-75"
                                                    style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                                                />
                                            );
                                        })()}
                                    </div>

                                    {dayTasks.map((task: Task) => {
                                        const timeS = task.due_time || '00:00'
                                        const [h_s, m_s] = timeS.split(':').map(Number)
                                        const [h_e, m_e] = (task.end_time || '23:59:59').split(':').map(Number)

                                        const startMinutes = h_s * 60 + m_s
                                        const endMinutes = h_e * 60 + m_e

                                        if (isNightHidden && (h_s < workingStart || h_s >= workingEnd)) return null

                                        const displayStartMinutes = isNightHidden ? (h_s - workingStart) * 60 + m_s : startMinutes
                                        const totalDisplayMinutes = hours.length * 60

                                        let duration = endMinutes - startMinutes
                                        if (resizingTaskState && resizingTaskState.id === task.id) {
                                            duration = resizingTaskState.currentDuration
                                        }
                                        if (movingTaskState && movingTaskState.id === task.id && !task.due_time) {
                                            duration = 60
                                        }
                                        if (duration < 15) duration = 15;

                                        let currentTopPct = (displayStartMinutes / totalDisplayMinutes) * 100
                                        const topPct = currentTopPct
                                        const heightPct = (duration / totalDisplayMinutes) * 100

                                        const overlaps = dayTasks.filter((other: Task) => {
                                            if (other.id === task.id) return false
                                            const oTimeS = other.due_time || '00:00'
                                            const [oh_s, om_s] = oTimeS.split(':').map(Number)
                                            const [oh_e, om_e] = (other.end_time || '23:59:59').split(':').map(Number)
                                            const oStartMinTotal = oh_s * 60 + om_s
                                            const oEndMinTotal = oh_e * 60 + om_e
                                            const tEndMinTotal = startMinutes + duration
                                            return (startMinutes < oEndMinTotal && tEndMinTotal > oStartMinTotal)
                                        })

                                        const overlappingGroup = [task, ...overlaps].sort((a: Task, b: Task) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                                        const index = overlappingGroup.findIndex((t: Task) => t.id === task.id)
                                        const totalOverlap = overlappingGroup.length
                                        const widthPctArr = 100 / totalOverlap
                                        const leftPctArr = index * widthPctArr

                                        const start = new Date(`${task.due_date!.split('T')[0]}T${task.due_time || '00:00:00'}`)
                                        let end: Date
                                        if (task.end_time) {
                                            end = new Date(`${(task.end_date || task.due_date!).split('T')[0]}T${task.end_time}`)
                                        } else {
                                            end = new Date(start.getTime() + duration * 60000)
                                        }

                                        const isSelected = selectedTaskId === task.id

                                        return (
                                            <div
                                                key={task.id}
                                                draggable="true"
                                                onDragStart={(e) => {
                                                    if (resizingTaskState) { e.preventDefault(); return }
                                                    e.dataTransfer.setData('taskId', task.id);
                                                    setDraggedTaskId(task.id);
                                                }}
                                                onDragEnd={() => setDraggedTaskId(null)}
                                                onClick={(e) => handleTaskClick(e, task)}
                                                onTouchStart={(e) => handleCalendarTaskTouchStart(e, task)}
                                                onTouchEnd={handleCalendarTaskTouchEnd}
                                                onTouchMove={handleCalendarTaskTouchEnd}
                                                style={{
                                                    top: `${topPct}%`,
                                                    height: `${heightPct}%`,
                                                    left: `${leftPctArr}%`,
                                                    width: `${widthPctArr}%`,
                                                    transform: movingTaskState?.id === task.id
                                                        ? `translateY(${movingTaskState.currentY - movingTaskState.startY}px) translateX(${movingTaskState.currentX - movingTaskState.startX}px) scale(1.05)`
                                                        : 'none',
                                                    boxShadow: movingTaskState?.id === task.id ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : '',
                                                    opacity: movingTaskState?.id === task.id ? 0.9 : 1,
                                                    zIndex: movingTaskState?.id === task.id ? 100 : (isSelected ? 40 : 10),
                                                    touchAction: 'none'
                                                }}
                                                className={`absolute p-2 rounded-xl text-[10px] font-bold leading-tight cursor-pointer shadow-md transition-none border-l-4 overflow-hidden 
                                                    ${isSelected ? 'ring-2 ring-black ring-offset-1 z-40' : 'hover:z-20'} 
                                                    ${task.status === 'done' ? 'bg-slate-100 border-slate-200 text-slate-300 opacity-60' : task.priority === 'high' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-indigo-50 border-indigo-500 text-indigo-700'}`}
                                            >
                                                <div className="">
                                                    <p className="truncate">{task.title}</p>
                                                    <p className={`text-[8px] mt-0.5 transition-all ${resizingTaskState?.id === task.id ? 'text-indigo-600 font-black scale-110 origin-left' : 'opacity-50'}`}>
                                                        {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                                    </p>
                                                </div>
                                                {isSelected && (
                                                    <div
                                                        onMouseDown={(e) => handleTaskResizeStart(e, task)}
                                                        onTouchStart={(e) => handleTaskResizeStart(e, task)}
                                                        className="absolute bottom-0 left-0 w-full h-4 cursor-ns-resize flex items-end justify-center pb-0.5 z-30 touch-none group"
                                                    >
                                                        <div className="w-8 h-1 bg-black/20 rounded-full group-active:bg-indigo-500 transition-colors"></div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden" onClick={() => setSelectedTaskId(null)}>
            <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm">
                {renderWeek()}
            </div>
        </div>
    )
}

export default CalendarView
