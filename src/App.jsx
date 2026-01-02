import React, { useEffect, useState, useCallback, useRef } from 'react'
import confetti from 'canvas-confetti'
import { supabase } from './supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  isToday,
  isSameMonth,
  parseISO
} from 'date-fns'
import { ru } from 'date-fns/locale'
import DatePicker from './components/DatePicker'

// Хук для дебаунса
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// Sidebar component
const SidebarContent = ({
  allFolders, allLists, allTags, tasks,
  selectedListId, selectedTagId, dateFilter,
  resetFilters, setSelectedListId, setSelectedTagId, setDateFilter,
  setIsSidebarOpen, collapsedFolders, toggleFolder,
  newTagName, setNewTagName, createTag,
  deleteFolder, deleteList, deleteTag,
  setIsAddPopupOpen,
  onDragStart, onDrop, onDropTask, fetchData,
  onDragStartFolder, onDropFolderSorting,
  onDragStartList, onDropListSorting,
  hoveredListId, setHoveredListId,
  dragOverListInfo, setDragOverListInfo,
  dragOverFolderInfo, setDragOverFolderInfo,
  setActiveView, activeView
}) => {
  const today = new Date().getDate()
  const [expandedTaskIds, setExpandedTaskIds] = useState({});
  const days = ['пн.', 'вт.', 'ср.', 'чт.', 'пт.', 'сб.', 'вс.']

  return (
    <div className="h-full flex flex-col bg-[#F9F9F9] border-r border-slate-200 font-sans text-[#333]">
      <div className="flex-1 overflow-y-auto pt-6 no-scrollbar">
        {/* APP LOGO */}
        <div className="px-6 mb-8 flex items-center gap-2 select-none">
          <div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-red-200">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12h4l3-6 4 12 3-6h2" />
            </svg>
          </div>
          <span className="text-lg font-black tracking-tight text-slate-800">PULSE</span>
        </div>

        {/* Смарт-списки */}
        <div className="px-3 space-y-0.5 mb-8">
          {[
            { id: 'calendar', label: 'Календарь', icon: '📅', count: 0, action: () => setActiveView('calendar'), active: activeView === 'calendar' },
            { id: 'inbox', label: 'Входящие', icon: '📥', count: tasks.filter(t => !t.list_id && !t.is_completed).length, action: () => { resetFilters(); setActiveView('tasks'); }, active: activeView === 'tasks' && !selectedTagId && !selectedListId && !dateFilter },
            { id: 'today', label: 'Сегодня', icon: '🗓️', count: tasks.filter(t => t.due_date?.split('T')[0] === new Date().toISOString().split('T')[0] && !t.is_completed).length, action: () => setDateFilter('today'), active: activeView === 'tasks' && dateFilter === 'today' },
            { id: 'tomorrow', label: 'Завтра', icon: '🌅', count: tasks.filter(t => t.due_date?.split('T')[0] === new Date(Date.now() + 86400000).toISOString().split('T')[0] && !t.is_completed).length, action: () => setDateFilter('tomorrow'), active: activeView === 'tasks' && dateFilter === 'tomorrow' },
          ].map(item => (
            <button key={item.id} onClick={() => { item.action(); setSelectedListId(null); setSelectedTagId(null); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition ${item.active ? 'bg-[#E5E5E5] text-black shadow-none' : 'text-[#666] hover:bg-[#F1F1F1]'}`}>
              <div className="flex items-center gap-3"><span className="text-base opacity-70 grayscale">{item.icon}</span> {item.label}</div>
              <span className="text-[11px] text-slate-400 font-normal">{item.count > 0 ? item.count : ''}</span>
            </button>
          ))}
        </div>

        {/* ПРОЕКТЫ (Header) */}
        <div className="px-6 mb-2 flex items-center justify-between group">
          <div className="flex items-center gap-2 cursor-pointer w-full" onClick={() => toggleFolder('lists_section')}>
            <span className={`text-[9px] text-slate-400 transition transform ${collapsedFolders['lists_section'] ? '-rotate-90' : ''}`}>▼</span>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Списки</p>
          </div>
          <button onClick={() => setIsAddPopupOpen(true)} className="text-slate-300 hover:text-black transition opacity-0 group-hover:opacity-100 text-lg leading-none mb-1 cursor-pointer z-10">+</button>
        </div>

        {!collapsedFolders['lists_section'] && (
          <div className="px-3 mb-8">
            {allFolders.map(folder => (
              <div key={folder.id}
                draggable="true"
                onDragStart={(e) => onDragStartFolder(e, folder.id)}
                onDragOver={e => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const position = y < rect.height / 2 ? 'top' : 'bottom';
                  const types = Array.from(e.dataTransfer.types).map(t => t.toLowerCase());
                  if (types.includes('folderid')) {
                    setDragOverFolderInfo({ id: folder.id, position });
                  }
                }}
                onDragLeave={e => {
                  setDragOverFolderInfo(null);
                }}
                onDrop={e => {
                  const pos = dragOverFolderInfo?.position;
                  setDragOverFolderInfo(null);
                  const draggedFolderId = e.dataTransfer.getData('folderId');
                  if (draggedFolderId) onDropFolderSorting(e, folder.id, pos);
                  else onDrop(e, folder.id);
                }}
                className={`mb-0.5 rounded-lg transition-colors border border-transparent box-border relative ${dragOverFolderInfo?.id === folder.id && dragOverFolderInfo?.position === 'top' ? 'mt-1' : ''} ${dragOverFolderInfo?.id === folder.id && dragOverFolderInfo?.position === 'bottom' ? 'mb-1' : ''}`}
              >
                {/* Drag Insertion Indicator Line for Folder */}
                {dragOverFolderInfo?.id === folder.id && (
                  <div className={`absolute left-0 right-0 h-0.5 bg-indigo-500 z-30 rounded-full ${dragOverFolderInfo.position === 'top' ? '-top-[3px]' : '-bottom-[3px]'}`}>
                    <div className="absolute left-0 -top-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white"></div>
                  </div>
                )}

                <div className="flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#F1F1F1] group" onClick={() => toggleFolder(folder.id)}>
                  <div className="flex items-center gap-2 font-semibold text-[#555] text-[13px]">
                    <span className={`text-[7px] transition transform ${collapsedFolders[folder.id] ? '-rotate-90' : ''}`}>▼</span>
                    <span className="text-base">📂</span>
                    <span className="truncate uppercase">{folder.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 ml-auto pr-2">
                    {tasks.filter(t => allLists.some(l => l.folder_id === folder.id && l.id === t.list_id) && !t.is_completed).length || ''}
                  </span>
                  <button onClick={(e) => deleteFolder(e, folder.id)} className="hidden group-hover:block text-slate-300 hover:text-red-500 text-[10px]">✕</button>
                </div>

                {!collapsedFolders[folder.id] && (
                  <div className="ml-5 space-y-0.5">
                    {allLists.filter(l => l.folder_id === folder.id).map(list => (
                      <button key={list.id}
                        draggable="true"
                        onDragStart={(e) => onDragStartList(e, list.id)}
                        onDragOver={e => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          const position = y < rect.height / 2 ? 'top' : 'bottom';
                          // DISTINGUISH: list sorting vs task move
                          const types = Array.from(e.dataTransfer.types).map(t => t.toLowerCase());
                          if (types.includes('listidforsort')) {
                            setDragOverListInfo({ id: list.id, position });
                            setHoveredListId(null);
                          } else {
                            setHoveredListId(list.id);
                            setDragOverListInfo(null);
                          }
                        }}
                        onDragLeave={() => { setHoveredListId(null); setDragOverListInfo(null); }}
                        onDrop={e => {
                          const pos = dragOverListInfo?.position;
                          setHoveredListId(null);
                          setDragOverListInfo(null);
                          const draggedListId = e.dataTransfer.getData('listIdForSort');
                          if (draggedListId) onDropListSorting(e, list.id, pos);
                          else onDropTask(e, list.id);
                        }}
                        onClick={() => { setSelectedListId(list.id); setSelectedTagId(null); setDateFilter(null); setIsSidebarOpen(false); setActiveView('tasks'); }}
                        className={`relative group w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${selectedListId === list.id ? 'bg-[#E5E5E5] text-black shadow-sm' : hoveredListId === list.id ? 'bg-indigo-600 text-white scale-[1.02] shadow-lg z-10' : 'text-[#666] hover:bg-[#F1F1F1]'} ${dragOverListInfo?.id === list.id && dragOverListInfo?.position === 'top' ? 'mt-1' : ''} ${dragOverListInfo?.id === list.id && dragOverListInfo?.position === 'bottom' ? 'mb-1' : ''}`}
                      >
                        {/* Drag Insertion Indicator Line */}
                        {dragOverListInfo?.id === list.id && (
                          <div className={`absolute left-0 right-0 h-0.5 bg-indigo-500 z-30 rounded-full ${dragOverListInfo.position === 'top' ? '-top-[3px]' : '-bottom-[3px]'}`}>
                            <div className="absolute left-0 -top-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white"></div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className={`opacity-90 ${hoveredListId === list.id ? 'grayscale-0' : ''}`}>{list.name.toUpperCase().includes('ЦЕЛИ') ? '⭐' : list.name.toUpperCase().includes('КУПИТЬ') ? '🛒' : '≡'}</span>
                          <span className="truncate">{list.name}</span>
                        </div>
                        <span className={`text-[11px] ml-auto pr-2 ${hoveredListId === list.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {tasks.filter(t => t.list_id === list.id && !t.is_completed).length || ''}
                        </span>
                        <button onClick={(e) => deleteList(e, list.id)} className={`hidden group-hover:block transition-colors ${hoveredListId === list.id ? 'text-white' : 'text-slate-300 hover:text-red-500'} text-[10px]`}>✕</button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {allLists.filter(l => !l.folder_id).map(list => (
              <button key={list.id}
                draggable="true"
                onDragStart={(e) => onDragStartList(e, list.id)}
                onDragOver={e => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const position = y < rect.height / 2 ? 'top' : 'bottom';
                  const types = Array.from(e.dataTransfer.types).map(t => t.toLowerCase());
                  if (types.includes('listidforsort')) {
                    setDragOverListInfo({ id: list.id, position });
                    setHoveredListId(null);
                  } else {
                    setHoveredListId(list.id);
                    setDragOverListInfo(null);
                  }
                }}
                onDragLeave={() => { setHoveredListId(null); setDragOverListInfo(null); }}
                onDrop={e => {
                  const pos = dragOverListInfo?.position;
                  setHoveredListId(null);
                  setDragOverListInfo(null);
                  const draggedListId = e.dataTransfer.getData('listIdForSort');
                  const draggedListIdForFolder = e.dataTransfer.getData('listId');
                  if (draggedListId) onDropListSorting(e, list.id, pos);
                  else if (draggedListIdForFolder) onDrop(e, null);
                  else onDropTask(e, list.id);
                }}
                onClick={() => { setSelectedListId(list.id); setSelectedTagId(null); setDateFilter(null); setIsSidebarOpen(false); setActiveView('tasks'); }}
                className={`relative group w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${selectedListId === list.id ? 'bg-[#E5E5E5] text-black shadow-sm' : hoveredListId === list.id ? 'bg-indigo-600 text-white scale-[1.02] shadow-lg z-10' : 'text-[#666] hover:bg-[#F1F1F1]'} ${dragOverListInfo?.id === list.id && dragOverListInfo?.position === 'top' ? 'mt-1' : ''} ${dragOverListInfo?.id === list.id && dragOverListInfo?.position === 'bottom' ? 'mb-1' : ''}`}
              >
                {/* Drag Insertion Indicator Line */}
                {dragOverListInfo?.id === list.id && (
                  <div className={`absolute left-0 right-0 h-0.5 bg-indigo-500 z-30 rounded-full ${dragOverListInfo.position === 'top' ? '-top-[3px]' : '-bottom-[3px]'}`}>
                    <div className="absolute left-0 -top-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white"></div>
                  </div>
                )}
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                  <span className={`opacity-70 grayscale ${hoveredListId === list.id ? 'grayscale-0' : ''}`}>≡</span>
                  <span className="truncate uppercase">{list.name}</span>
                </div>
                <span className={`text-[11px] ml-auto pr-2 ${hoveredListId === list.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                  {tasks.filter(t => t.list_id === list.id && !t.is_completed).length || ''}
                </span>
                <button onClick={(e) => deleteList(e, list.id)} className={`hidden group-hover:block transition-colors ${hoveredListId === list.id ? 'text-white' : 'text-slate-300 hover:text-red-500'} text-[10px]`}>✕</button>
              </button>
            ))}
          </div>
        )}

        {/* TAGS (Header + Collapsible) */}
        <div className="px-6 mb-2 flex items-center justify-between group">
          <div className="flex items-center gap-2 cursor-pointer w-full" onClick={() => toggleFolder('tags_section')}>
            <span className={`text-[9px] text-slate-400 transition transform ${collapsedFolders['tags_section'] ? '-rotate-90' : ''}`}>▼</span>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Метки</p>
          </div>
          <button onClick={() => { /* Logic to add tag - maybe reuse popup or new inline input? For now simple prompt */ const name = prompt('Новая метка:'); if (name) { setNewTagName(name); setTimeout(createTag, 100); } }} className="text-slate-300 hover:text-black transition opacity-0 group-hover:opacity-100 text-lg leading-none mb-1 cursor-pointer z-10">+</button>
        </div>

        {!collapsedFolders['tags_section'] && (
          <div className="px-3 mb-6">
            {allTags.map(tag => (
              <button key={tag.id}
                onClick={() => { setSelectedTagId(tag.id); setSelectedListId(null); setDateFilter(null); setIsSidebarOpen(false); setActiveView('tasks'); }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] font-medium transition group ${selectedTagId === tag.id ? 'bg-indigo-50 text-indigo-700' : 'text-[#666] hover:bg-[#F1F1F1]'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#cbd5e1' }}></div>
                  <span className="truncate">{tag.name}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal">{tasks.filter(t => t.tags && t.tags.some(tt => tt.id === tag.id) && !t.is_completed).length || ''}</span>
                <button onClick={(e) => deleteTag(e, tag.id)} className={`hidden group-hover:block transition-colors text-slate-300 hover:text-red-500 text-[10px] ml-2`}>✕</button>
              </button>
            ))}
          </div>
        )}

      </div>

      {/* AI Assistant Chat Input */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="relative group">
          <input
            type="text"
            placeholder="Спросить ИИ..."
            className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center bg-indigo-600 text-white rounded-lg opacity-80 hover:opacity-100 transition shadow-sm">
            <span className="text-[10px]">✨</span>
          </button>
        </div>
        <p className="text-[9px] text-slate-400 mt-2 px-1 text-center font-medium uppercase tracking-tight opacity-60">Smart Assistant Beta</p>
      </div>
    </div>
  )
}

const CalendarView = ({ tasks, currentDate, setCurrentDate, onTaskClick, onDropTaskOnCalendar, resizingTaskState, handleTaskResizeStart, hourHeight, setHourHeight, isNightHidden, setIsNightHidden, calendarDays = 7, movingTaskState, handleCalendarTaskTouchStart, handleCalendarTaskTouchMove, handleCalendarTaskTouchEnd, selectedTaskId }) => {
  const [dragOverSlot, setDragOverSlot] = useState(null); // 'month-DATE', 'all-day-DATE', or 'hour-DATE-HOUR'
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const safeTasks = Array.isArray(tasks) ? tasks : []
  /* Internal header removed - moved to App.jsx main header */


  const renderWeek = () => {
    let startDate, days
    if (calendarDays === 7) {
      startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
      days = eachDayOfInterval({ start: startDate, end: endOfWeek(startDate, { weekStartsOn: 1 }) })
    } else {
      startDate = currentDate
      days = Array.from({ length: calendarDays }, (_, i) => addDays(startDate, i))
    }

    // Calculate Days for Drop Logic (Shared Logic Buffer)
    // We can't export this easily, so we duplicate logic in handleEnd or pass it back.
    // For now, duplicate logic in handleEnd is safer given component structure.
    const allHours = Array.from({ length: 24 }, (_, i) => i)
    const hours = isNightHidden ? allHours.filter(h => h >= 7 && h <= 21) : allHours

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const zoomSpeed = 0.1
        const delta = e.deltaY > 0 ? -1 : 1
        const newHeight = Math.max(30, Math.min(200, hourHeight + delta * 5))
        setHourHeight(newHeight)
      }
    }

    const handleGridDragOver = (e, day) => {
      e.preventDefault()
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top

      const rowHeight = rect.height / 24

      // Calculate Time from Y ratio
      const ratio = y / rect.height
      const totalMinutes = ratio * 1440

      // Snap to 30 minutes for highlight
      const snappedMinutes = Math.floor(totalMinutes / 30) * 30
      const hh = Math.floor(snappedMinutes / 60)
      const mm = snappedMinutes % 60

      if (hh >= 0 && hh < 24) {
        const slotId = `slot-${format(day, 'yyyy-MM-dd')}-${hh}-${mm}`
        if (dragOverSlot !== slotId) setDragOverSlot(slotId)
      }
    }

    const handleGridDrop = (e, day) => {
      e.preventDefault()
      setDragOverSlot(null)
      const taskId = e.dataTransfer.getData('taskId')
      if (!taskId) return

      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top

      // Calculate Time from Y ratio
      const ratio = y / rect.height
      const totalMinutes = ratio * 1440

      // Snap to 30 minutes
      const snappedMinutes = Math.floor(totalMinutes / 30) * 30

      const hh = Math.floor(snappedMinutes / 60)
      const mm = snappedMinutes % 60

      if (hh >= 0 && hh < 24) {
        const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
        onDropTaskOnCalendar(taskId, day, timeStr)
      }
    }

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header Days */}
        <div className={`grid border-b border-slate-100 bg-slate-50/30 shrink-0`} style={{ gridTemplateColumns: `60px repeat(${calendarDays}, 1fr)` }}>
          <div className="border-r border-slate-100"></div>
          {/* Day Header */}
          {days.map((day, i) => (
            <div key={i} className="flex flex-col items-center py-2 border-r border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(day, 'EE', { locale: ru })}</span>
              <span className={`text-sm font-black w-7 h-7 flex items-center justify-center rounded-full mt-1 ${isToday(day) ? 'bg-indigo-600 text-white' : 'text-slate-800'}`}>
                {format(day, 'd')}
              </span>
            </div>
          ))}
        </div>

        {/* All Day Slots */}
        <div id="all-day-row" className={`grid bg-slate-50/30 border-b border-slate-100 min-h-[40px] z-50`} style={{ gridTemplateColumns: `60px repeat(${calendarDays}, 1fr)` }}>
          <div className="flex items-center justify-center border-r border-slate-100 py-2">
            <span className="text-[8px] font-black text-slate-400 uppercase vertical-text">Весь день</span>
          </div>
          {days.map((day, i) => {
            const dayStr = format(day, 'yyyy-MM-dd')
            const allDayTasks = safeTasks.filter(t => {
              if (!t.due_date) return false
              // Is this day within the task date range?
              const startStr = t.due_date.split('T')[0]
              const endStr = (t.end_date || t.due_date).split('T')[0]
              const isWithinDays = dayStr >= startStr && dayStr <= endStr
              // Is it an all-day task? (no due_time)
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
                className={`border-r border-slate-100 p-2 min-h-[50px] bg-slate-50/10 transition-colors ${dragOverSlot === slotId ? 'bg-indigo-50 ring-2 ring-indigo-200 ring-inset opacity-100 z-10' : ''}`}
              >
                <div className="space-y-1">
                  {allDayTasks.map(task => (
                    <div key={task.id}
                      draggable="true"
                      onDragStart={(e) => { e.dataTransfer.setData('taskId', task.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onClick={() => onTaskClick(task)}
                      className={`text-[10px] p-2 rounded-lg truncate cursor-pointer shadow-sm ${task.is_completed ? 'bg-slate-100 text-slate-300' : 'bg-white border border-slate-100 text-slate-700'}`}>
                      {task.title}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Main Grid: Columns */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative" onWheel={handleWheel}>
          <div id="week-view-container" className={`grid bg-white relative`} style={{ height: `${hourHeight * hours.length}px`, gridTemplateColumns: `60px repeat(${calendarDays}, 1fr)` }}>

            {/* Time Labels Column */}
            <div className="border-r border-slate-100">
              {hours.map(h => (
                <div key={h} className="border-b border-slate-50 relative" style={{ height: `${hourHeight}px` }}>
                  <span className="absolute -top-2 right-2 text-[10px] font-bold text-slate-300">{format(new Date().setHours(h, 0), 'HH:00')}</span>
                </div>
              ))}
            </div>

            {/* Current Time Indicator (Global Line) */}
            {(() => {
              const mins = now.getHours() * 60 + now.getMinutes()
              if (isNightHidden && (now.getHours() < 7 || now.getHours() > 21)) return null
              const dayMinutes = isNightHidden ? (now.getHours() - 7) * 60 + now.getMinutes() : mins
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

            {/* Day Columns */}
            {days.map((day, i) => {
              const dayStr = format(day, 'yyyy-MM-dd')
              const dayTasks = safeTasks.filter(t => {
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
                  {/* Drag Highlight */}
                  {dragOverSlot && dragOverSlot.startsWith(`slot-${format(day, 'yyyy-MM-dd')}`) && (
                    (() => {
                      const parts = dragOverSlot.split('-')
                      const h = parseInt(parts[4])
                      const m = parseInt(parts[5])
                      const top = (h * 60 + m) / 1440 * 100
                      return (
                        <div
                          className="absolute left-0 w-full bg-indigo-500/10 border-2 border-indigo-500/30 rounded-xl pointer-events-none z-10"
                          style={{
                            top: `${top}%`,
                            height: `${30 / 1440 * 100}%`
                          }}
                        >
                          <div className="absolute top-1 left-2 text-[8px] font-black text-indigo-400 uppercase tracking-tighter">
                            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                          </div>
                        </div>
                      )
                    })()
                  )}
                  {/* Background Grid Lines */}
                  <div className="absolute inset-0 pointer-events-none">
                    {hours.map(h => <div key={h} className="border-b border-slate-50" style={{ height: `${hourHeight}px` }}></div>)}
                  </div>

                  {/* Tasks */}
                  {dayTasks.map((task, idx) => {
                    // Determine visual props
                    const [h_s, m_s] = task.due_time.split(':').map(Number)
                    const [h_e, m_e] = (task.end_time || '23:59:59').split(':').map(Number)

                    const startMinutes = h_s * 60 + m_s
                    const endMinutes = h_e * 60 + m_e

                    if (isNightHidden && (h_s < 7 || h_s > 21)) return null

                    const displayStartMinutes = isNightHidden ? (h_s - 7) * 60 + m_s : startMinutes
                    const totalDisplayMinutes = hours.length * 60

                    let duration = endMinutes - startMinutes
                    if (resizingTaskState && resizingTaskState.id === task.id) {
                      duration = resizingTaskState.currentDuration
                    }
                    if (duration < 15) duration = 15;

                    // HANDLE MOVING VISUALS
                    let currentTopPct = (displayStartMinutes / totalDisplayMinutes) * 100
                    if (movingTaskState && movingTaskState.id === task.id) {
                      const rect = document.getElementById('week-view-container')?.getBoundingClientRect()
                      if (rect) {
                        const deltaY = movingTaskState.currentY - movingTaskState.startY
                        const deltaMin = (deltaY / rect.height) * totalDisplayMinutes
                        const newStart = displayStartMinutes + deltaMin
                        currentTopPct = (newStart / totalDisplayMinutes) * 100
                      }
                    }

                    const topPct = currentTopPct
                    const heightPct = (duration / totalDisplayMinutes) * 100

                    // Overlap logic
                    const overlaps = dayTasks.filter(other => {
                      if (other.id === task.id) return false
                      const [oh_s, om_s] = other.due_time.split(':').map(Number)
                      const [oh_e, om_e] = (other.end_time || '23:59:59').split(':').map(Number)
                      const oStartMinTotal = oh_s * 60 + om_s
                      const oEndMinTotal = oh_e * 60 + om_e

                      const tEndMinTotal = startMinutes + duration
                      return (startMinutes < oEndMinTotal && tEndMinTotal > oStartMinTotal)
                    })

                    const overlappingGroup = [task, ...overlaps].sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                    const index = overlappingGroup.findIndex(t => t.id === task.id)
                    const totalOverlap = overlappingGroup.length
                    const widthPct = 100 / totalOverlap
                    const leftPct = index * widthPct

                    const start = new Date(`${task.due_date.split('T')[0]}T${task.due_time}`)
                    const end = task.end_time ? new Date(`${(task.end_date || task.due_date).split('T')[0]}T${task.end_time}`) : new Date(start.getTime() + duration * 60000)

                    const isSelected = selectedTaskId === task.id

                    return (
                      <div
                        key={task.id}
                        draggable="true"
                        onDragStart={(e) => {
                          if (resizingTaskState) { e.preventDefault(); return }
                          e.dataTransfer.setData('taskId', task.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onTaskClick(task)
                        }}

                        // Touch Support
                        onTouchStart={(e) => handleCalendarTaskTouchStart(e, task)}
                        onTouchMove={(e) => handleCalendarTaskTouchMove(e, task)}
                        onTouchEnd={handleCalendarTaskTouchEnd}

                        style={{
                          top: `${topPct}%`,
                          height: `${heightPct}%`,
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          opacity: movingTaskState?.id === task.id ? 0.6 : 1,
                          zIndex: movingTaskState?.id === task.id ? 50 : (isSelected ? 40 : 'auto'),
                          touchAction: 'none'
                        }}
                        id={`calendar-task-${task.id}`}
                        className={`absolute p-2 rounded-xl text-[10px] font-bold leading-tight cursor-pointer shadow-md transition-none border-l-4 overflow-hidden 
                          ${isSelected ? 'ring-2 ring-black ring-offset-1 z-40' : 'hover:z-20'} 
                          ${task.is_completed ? 'bg-slate-100 border-slate-200 text-slate-300 opacity-60' : task.priority === 'high' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-indigo-50 border-indigo-500 text-indigo-700'}`}
                      >
                        <div className="pointer-events-none">
                          <p className="truncate">{task.title}</p>
                          <p className={`text-[8px] mt-0.5 transition-all ${resizingTaskState?.id === task.id ? 'text-indigo-600 font-black scale-110 origin-left' : 'opacity-50'}`}>
                            {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                          </p>
                        </div>

                        {/* Resize Handle - ONLY visible if Selected */}
                        {isSelected && (
                          <div
                            onMouseDown={(e) => handleTaskResizeStart(e, task)}
                            onTouchStart={(e) => handleTaskResizeStart(e, task)}
                            className="absolute bottom-0 left-0 w-full h-4 cursor-ns-resize flex items-end justify-center pb-0.5 z-30 touch-none group"
                          >
                            {/* Visual Indicator for the handle */}
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
    <div className="flex-1 flex flex-col h-full overflow-hidden" onClick={() => onTaskClick(null)}>
      <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm">
        {renderWeek()}
      </div>
    </div>
  )
}

function App() {
  const [tasks, setTasks] = useState([])
  const [allTags, setAllTags] = useState([])
  const [allLists, setAllLists] = useState([])
  const [allFolders, setAllFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [dropPosition, setDropPosition] = useState(null) // 'top' | 'bottom'
  const [isSaving, setIsSaving] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [suggestVersion, setSuggestVersion] = useState(0)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const lastFetchedTasksJson = useRef('')

  // Фильтрация
  const [selectedTagId, setSelectedTagId] = useState(null)
  const [selectedListId, setSelectedListId] = useState(null)
  const [dateFilter, setDateFilter] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('order') // 'order', 'title', 'date', 'tag'
  const [groupBy, setGroupBy] = useState('none') // 'none', 'priority', 'date'
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [activeView, setActiveView] = useState('tasks') // 'tasks' or 'calendar'
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date())
  const [hourHeight, setHourHeight] = useState(60)
  const [isNightHidden, setIsNightHidden] = useState(false)

  // Состояния для модального окна
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [currentTaskId, setCurrentTaskId] = useState(null)
  const datePickerRef = useRef(null)
  const datePickerBtnRef = useRef(null)
  const tagSelectBtnRef = useRef(null)
  const projectSelectRef = useRef(null)
  const projectSelectBtnRef = useRef(null)
  const tagSelectRef = useRef(null)

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)
  const [showProjectSelect, setShowProjectSelect] = useState(false)
  const [showTagSelect, setShowTagSelect] = useState(false)



  // Состояния сайдбара
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(window.innerWidth >= 1024)
  const [collapsedFolders, setCollapsedFolders] = useState({})

  // Состояния для создания папок/списков
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false)
  const [addMode, setAddMode] = useState('list')
  const [newName, setNewName] = useState('')
  const [targetFolderId, setTargetFolderId] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [hoveredListId, setHoveredListId] = useState(null)
  const [dragOverListInfo, setDragOverListInfo] = useState(null) // { id, position: 'top' | 'bottom' }
  const [dragOverFolderInfo, setDragOverFolderInfo] = useState(null) // { id, position: 'top' | 'bottom' }
  const [dragOverTaskId, setDragOverTaskId] = useState(null)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [swipeTaskId, setSwipeTaskId] = useState(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const swipeStartX = useRef(0)

  // Ширина панелей
  const [sidebarWidth, setSidebarWidth] = useState(window.innerWidth * 0.15)
  const [panelWidth, setPanelWidth] = useState(window.innerWidth * 0.35)
  const isResizingSidebar = useRef(false)
  const isResizingPanel = useRef(false) // Task Detail Panel
  const isResizingCalendar = useRef(false) // Calendar Panel
  const [calendarWidth, setCalendarWidth] = useState(window.innerWidth * 0.15)
  const [isCalendarPanelOpen, setIsCalendarPanelOpen] = useState(true) // Always open on start as requested

  // Resizing Tasks
  const [resizingTaskState, setResizingTaskState] = useState(null) // { id, startY, originalDuration, currentDuration }

  // Moving Tasks (Mobile Touch)
  const [movingTaskState, setMovingTaskState] = useState(null) // { id, startY, currentY, startTopPercent, originalTime }
  const longPressTimer = useRef(null)

  // Refs for performance (Event Listeners)
  const movingTaskStateRef = useRef(movingTaskState)
  const resizingTaskStateRef = useRef(resizingTaskState)

  useEffect(() => { movingTaskStateRef.current = movingTaskState }, [movingTaskState])
  useEffect(() => { resizingTaskStateRef.current = resizingTaskState }, [resizingTaskState])

  // Calendar View Mode: 1, 3, or 7 days
  const [calendarDays, setCalendarDays] = useState(window.innerWidth < 768 ? 1 : 7)
  const [selectedCalendarTaskId, setSelectedCalendarTaskId] = useState(null)

  // Animation State for Exiting Tasks
  const [exitingTaskIds, setExitingTaskIds] = useState([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState({});
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, taskId: null });

  const handleTaskCompletion = (e, task) => {
    e.stopPropagation()
    if (task.is_completed) {
      // If un-completing, just toggle immediately
      toggleTask(task.id, task.is_completed)
      return
    }

    // Fireworks
    const rect = e.target.getBoundingClientRect()
    const x = (rect.left + rect.width / 2) / window.innerWidth
    const y = (rect.top + rect.height / 2) / window.innerHeight

    try {
      confetti({
        origin: { x, y },
        particleCount: 60,
        spread: 70,
        startVelocity: 20,
        gravity: 2,
        ticks: 150,
        colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'],
        disableForReducedMotion: true,
        zIndex: 1000,
        scalar: 0.6
      })
    } catch (err) {
      console.error("Confetti failed:", err)
    }

    // Fly Away Animation triggers
    setExitingTaskIds(prev => [...prev, task.id])

    // Wait for animation then toggle
    setTimeout(() => {
      toggleTask(task.id, task.is_completed)
      setExitingTaskIds(prev => prev.filter(id => id !== task.id))
    }, 700)
  }

  useEffect(() => {
    const handleResize = () => {
      // Optionally auto-switch on resize, but user might want control.
      // Let's just set default only on init (above)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])




  // --- TOUCH HANDLERS FOR CALENDAR TASK MOVING ---
  const handleCalendarTaskTouchStart = (e, task) => {
    if (resizingTaskState) return
    // "Two-step" rule: Must trigger selection first. If not selected, ignore drag to allow Click to fire.
    if (selectedCalendarTaskId !== task.id) return

    const touch = e.touches[0]
    const sY = touch.clientY
    const sX = touch.clientX

    swipeStartX.current = sX
    startY.current = sY

    // Using a Ref wouldn't re-render, but here we set state on timeout
    longPressTimer.current = setTimeout(() => {
      // Safe date formatting for Local Day
      let dayStr = task.due_date.split('T')[0]
      // Try to better guess local day
      try {
        const d = new Date(task.due_date)
        dayStr = format(d, 'yyyy-MM-dd')
      } catch (e) { }

      setMovingTaskState({
        id: task.id,
        startY: sY,
        currentY: sY,
        startDayStr: dayStr,
        originalTime: task.due_time
      })
      if (navigator.vibrate) navigator.vibrate(100)
    }, 200)
  }

  const handleCalendarTaskTouchMove = (e, task) => {
    // Check tolerance
    if (!movingTaskState && longPressTimer.current) {
      const touch = e.touches[0]
      const diffX = Math.abs(touch.clientX - swipeStartX.current)
      const diffY = Math.abs(touch.clientY - startY.current)

      if (diffX > 10 || diffY > 10) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null

        // If moved significantly, start dragging immediately
        if (task) {
          let dayStr = task.due_date.split('T')[0]
          try {
            const d = new Date(task.due_date)
            dayStr = format(d, 'yyyy-MM-dd')
          } catch (e) { }

          const newState = {
            id: task.id,
            startY: startY.current,
            currentY: touch.clientY,
            startX: swipeStartX.current,
            currentX: touch.clientX,
            startDayStr: dayStr,
            originalTime: task.due_time
          }

          // CRITICAL: Sync ref IMMEDIATELY so global handler sees it in the same event loop/bubble
          movingTaskStateRef.current = newState
          setMovingTaskState(newState)
        }
      }
    }
  }

  const handleCalendarTaskTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // --- SUBTASKS HANDLERS ---
  const handleAddSubtask = () => {
    setSubtasks([...subtasks, { id: crypto.randomUUID(), text: '', completed: false }])
  }

  const handleToggleSubtask = (id) => {
    setSubtasks(subtasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const handleDeleteSubtask = (id) => {
    setSubtasks(subtasks.filter(t => t.id !== id))
  }

  const handleSubtaskChange = (id, text) => {
    setSubtasks(subtasks.map(t => t.id === id ? { ...t, text } : t))
  }

  // --- RESIZE HANDLER UPDATE ---
  const handleTaskResizeStart = (e, task) => {
    e.stopPropagation()
    // Support Touch or Mouse
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY

    // ... logic same as before, just using clientY ...
    e.preventDefault() // prevent scroll on touch

    let duration = 60
    if (task.end_date && task.due_date) {
      // Correctly include times in duration calculation
      const start = new Date(`${task.due_date}T${task.due_time || '00:00:00'}`)
      const end = task.end_time
        ? new Date(`${task.end_date}T${task.end_time}`)
        : new Date(`${task.end_date}T00:00:00`)

      const diffMs = end - start
      // Fallback if diff is weird (e.g. 0 or negative due to bad data), default to 60
      if (diffMs > 0) duration = diffMs / 60000
    }
    setResizingTaskState({
      id: task.id,
      startY: clientY,
      originalDuration: duration,
      currentDuration: duration
    });
    // Sync Ref Immediately for safety
    resizingTaskStateRef.current = {
      id: task.id,
      startY: clientY,
      originalDuration: duration,
      currentDuration: duration
    };

    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    document.body.classList.add('resizing') // Prevent pull-to-refresh etc
  }
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('low')
  const [dueDate, setDueDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isPreviewMode, setIsPreviewMode] = useState(false) // Markdown Preview Toggle
  const [subtasks, setSubtasks] = useState([]) // Subtasks State
  const [dueTime, setDueTime] = useState('')
  const [dueTimeEnd, setDueTimeEnd] = useState('')
  const [duration, setDuration] = useState(60)
  const [listId, setListId] = useState(null)
  const [selectedTags, setSelectedTags] = useState([])
  const [editingTaskId, setEditingTaskId] = useState(null) // Inline edit



  // Состояния для жеста закрытия
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)
  const startY = useRef(0)

  const handleAiSuggest = async () => {
    if (!title) return
    setIsAiLoading(true)
    setAiSuggestion(null)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_KEY || import.meta.env.VITE_GOOGLE_API_KEY
      if (!apiKey) {
        alert('API Key not found. Please check VITE_GEMINI_KEY in .env')
        setIsAiLoading(false)
        return
      }
      const genAI = new GoogleGenerativeAI(apiKey)
      // MODEL DEFINITION: Change model name here (e.g., "gemini-2.5-flash", "gemini-2.5-pro")
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" })
      const prompt = `Task: ${title}\nDescription: ${description}\n\nSuggest the single most important immediate next step to complete this task. Keep it short, actionable, and encouraging. Answer in Russian.`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      setAiSuggestion(text)
    } catch (error) {
      console.error("AI Error:", error)
      alert(`Ошибка AI: ${error.message}`)
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleApplySuggestion = async () => {
    if (!aiSuggestion || !currentTaskId) return

    // Create subtask
    try {
      const { data, error } = await supabase.from('tasks').insert([
        {
          title: aiSuggestion.replace(/^[\s\-\*]+/, ''), // clean bullets 
          parent_id: currentTaskId,
          list_id: listId, // Inherit project
          user_id: (await supabase.auth.getUser()).data.user?.id,
          created_at: new Date().toISOString()
        }
      ]).select()

      if (error) throw error

      // Update local state is tricky because subtasks might be fetched separately.
      // But we can verify by re-fetching or updating tasks list locally if available.
      // Easiest is to force refresh or update subtasks list if it's local.
      // But here we rely on 'tasks' state. 
      // Let's just create a local representation and add it.
      if (data && data[0]) {
        // Optionally notify user
        setAiSuggestion(null) // clear suggestion
        fetchData(true) // refresh tasks to show new subtask
      }

    } catch (e) {
      console.error("Apply Error:", e)
      alert("Не удалось создать подзадачу")
    }
  }


  const debouncedTitle = useDebounce(title, 300)
  const debouncedDescription = useDebounce(description, 300)
  const debouncedPriority = useDebounce(priority, 300)
  const debouncedDueDate = useDebounce(dueDate, 300)
  const debouncedDueTime = useDebounce(dueTime, 300)
  const debouncedDueTimeEnd = useDebounce(dueTimeEnd, 300)
  const debouncedDuration = useDebounce(duration, 300)
  const debouncedTags = useDebounce(selectedTags, 300)
  const debouncedListId = useDebounce(listId, 300)

  // --- 1. ЗАГРУЗКА ---
  async function fetchData(background = false) {
    if (!background) setLoading(true)
    try {
      const [tagsRes, listsRes, foldersRes, tasksRes] = await Promise.all([
        supabase.from('tags').select('*').order('name'),
        supabase.from('lists').select('*').order('order_index', { ascending: true }),
        supabase.from('folders').select('*').order('order_index', { ascending: true }),
        supabase
          .from('tasks')
          .select('*, tags:task_tags(tag_id, tags(*))')
          .order('order_index', { ascending: true }) // Primary Sort
          .order('id', { ascending: false }) // Secondary Sort
      ])

      if (tagsRes.data) setAllTags(tagsRes.data)
      if (listsRes.data) setAllLists(listsRes.data)
      if (foldersRes.data) setAllFolders(foldersRes.data)

      if (tasksRes.data) {
        const formattedTasks = tasksRes.data.map(task => ({
          ...task,
          tags: task.tags ? task.tags.map(t => t.tags).filter(Boolean) : []
        }))

        // Prevent reset of form state if we are currently editing the task that was just refetched
        const tasksJson = JSON.stringify(formattedTasks)
        if (tasksJson !== lastFetchedTasksJson.current) {
          lastFetchedTasksJson.current = tasksJson
          setTasks(formattedTasks)
        }
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const onDropTaskOnTask = async (draggedTaskId, targetTaskId) => {
    if (!draggedTaskId || !targetTaskId || String(draggedTaskId) === String(targetTaskId)) return
    // Simple check: don't allow nesting if target is already a subtask
    const targetTask = tasks.find(t => String(t.id) === String(targetTaskId))
    if (targetTask?.parent_id) return

    setTasks(prev => prev.map(t => String(t.id) === String(draggedTaskId) ? { ...t, parent_id: targetTaskId } : t))
    await supabase.from('tasks').update({ parent_id: targetTaskId }).eq('id', draggedTaskId)
    fetchData(true)
  }

  const onDropTaskOnCalendar = async (taskId, date, time = null) => {
    if (!taskId) return

    // Get current task data from state first, fallback to DB
    const localTask = tasks.find(t => String(t.id) === String(taskId))
    let currentTaskDate = localTask?.due_date // This will now be a 'YYYY-MM-DD' string
    let currentTaskTime = localTask?.due_time // This will be 'HH:mm:ss'
    let currentEndDate = localTask?.end_date
    let currentEndTime = localTask?.end_time
    if (!currentTaskDate && !currentTaskTime && !currentEndDate && !currentEndTime) {
      const { data: dbTask, error: fetchError } = await supabase.from('tasks').select('due_date, due_time, end_date, end_time').eq('id', taskId).single()
      if (fetchError) console.error('Error fetching task for drop:', fetchError)
      currentTaskDate = dbTask?.due_date
      currentTaskTime = dbTask?.due_time
      currentEndDate = dbTask?.end_date
      currentEndTime = dbTask?.end_time
    }

    const newDateStr = format(date, 'yyyy-MM-dd')
    let newFullEndDate = newDateStr

    // If it was a timed task and we move it back to time or stay in time
    if (time && time !== 'all-day') {
      // Logic for timed drop
      const newDueTime = time
      let newEndTime = null

      if (currentEndDate && currentTaskDate && currentTaskTime && currentEndTime) {
        // Calculate original duration to maintain it
        const start = new Date(`${currentTaskDate}T${currentTaskTime}`)
        const end = new Date(`${currentEndDate}T${currentEndTime}`)
        const durMs = end - start

        const newStart = new Date(`${newDateStr}T${newDueTime}`)
        const newEnd = new Date(newStart.getTime() + durMs)

        newFullEndDate = format(newEnd, 'yyyy-MM-dd')
        newEndTime = format(newEnd, 'HH:mm:ss')
      } else {
        // Fallback for tasks that didn't have full time info, default to 1 hour duration
        const newStart = new Date(`${newDateStr}T${newDueTime}`)
        const newEnd = new Date(newStart.getTime() + 60 * 60000)
        newFullEndDate = format(newEnd, 'yyyy-MM-dd')
        newEndTime = format(newEnd, 'HH:mm:ss')
      }

      setTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, due_date: newDateStr, due_time: newDueTime, end_date: newFullEndDate, end_time: newEndTime } : t))
      await supabase.from('tasks').update({ due_date: newDateStr, due_time: newDueTime, end_date: newFullEndDate, end_time: newEndTime }).eq('id', taskId)
    } else {
      // All-day drop: clear times
      setTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, due_date: newDateStr, due_time: null, end_date: newDateStr, end_time: null } : t))
      await supabase.from('tasks').update({ due_date: newDateStr, due_time: null, end_date: newDateStr, end_time: null }).eq('id', taskId)
    }
    fetchData(true)
  }

  const onRemoveParent = async (taskId) => {
    if (!taskId) return
    setTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, parent_id: null } : t))
    const { error } = await supabase.from('tasks').update({ parent_id: null }).eq('id', taskId)
    if (error) console.error('Error removing parent_id:', error)
    fetchData(true)
  }

  const handleTaskSwipe = (taskId, direction) => {
    const currentTask = tasks.find(t => String(t.id) === String(taskId));
    if (!currentTask) return;

    if (direction === 'right') {
      const parentCandidateList = tasks.filter(t => !t.parent_id || !tasks.some(pt => pt.id === t.parent_id));
      const idx = parentCandidateList.findIndex(t => String(t.id) === String(taskId));
      if (idx > 0) {
        onDropTaskOnTask(taskId, parentCandidateList[idx - 1].id);
      }
    } else if (direction === 'left') {
      if (currentTask.parent_id) {
        onRemoveParent(taskId);
      }
    }
  }

  const handleTaskTouchStart = (e, taskId) => {
    swipeStartX.current = e.touches[0].clientX;
    setSwipeTaskId(taskId);
    setSwipeOffset(0);
  }

  const handleTaskTouchMove = (e, taskId) => {
    if (swipeTaskId !== taskId) return;
    const currentX = e.touches[0].clientX;
    let diff = currentX - swipeStartX.current;
    if (diff > 80) diff = 80;
    if (diff < -80) diff = -80;
    setSwipeOffset(diff);
  }

  const handleTaskTouchEnd = (taskId) => {
    if (swipeTaskId !== taskId) return;
    if (swipeOffset > 40) handleTaskSwipe(taskId, 'right');
    if (swipeOffset < -40) handleTaskSwipe(taskId, 'left');
    setSwipeTaskId(null);
    setSwipeOffset(0);
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 20000)
    return () => clearInterval(interval)
  }, [])

  // --- АВТОСОХРАНЕНИЕ ---
  const autoSave = useCallback(async () => {
    if (!currentTaskId || !title.trim()) return
    setIsSaving(true)

    // Prepare separate Date and Time values
    let finalDueDate = dueDate || null
    let finalDueTime = null
    let finalEndDate = endDate || dueDate || null
    let finalEndTime = null

    if (dueDate && dueTime) {
      finalDueTime = `${dueTime}:00`

      // Calculate End Time if needed
      if (dueTimeEnd) {
        finalEndTime = `${dueTimeEnd}:00`
        if (endDate) finalEndDate = endDate
      } else if (duration) {
        const start = new Date(`${dueDate}T${dueTime}`)
        const end = new Date(start.getTime() + duration * 60000)
        finalEndTime = format(end, 'HH:mm:ss')
        finalEndDate = format(end, 'yyyy-MM-dd')
      } else {
        // Default to +1 hour if no end/duration set? 
        // Or leave null? User said "either one or other". 
        // If duration is NOT set, maybe we shouldn't force an interval?
        // But Calendar view NEEDS an interval. Let's default to 1h for consistency if just time is picked.
        const start = new Date(`${dueDate}T${dueTime}`)
        const end = new Date(start.getTime() + 60 * 60000) // Default 1h
        finalEndTime = format(end, 'HH:mm:ss')
        finalEndDate = format(end, 'yyyy-MM-dd')
      }
    } else if (dueDate) {
      // All-day
      finalDueTime = null
      finalEndTime = null
      finalEndDate = dueDate
    }

    const taskData = {
      title,
      description: description || '',
      subtasks,
      priority: priority || 'low',
      due_date: finalDueDate,
      due_time: finalDueTime,
      end_date: finalEndDate,
      end_time: finalEndTime,
      list_id: listId
    }

    try {
      const { error: updateError } = await supabase.from('tasks').update(taskData).eq('id', currentTaskId)
      if (updateError) {
        console.error('AutoSave update failed:', updateError)
      }

      const { error: deleteTagsError } = await supabase.from('task_tags').delete().eq('task_id', currentTaskId)
      if (deleteTagsError) console.error('AutoSave delete tags failed:', deleteTagsError)

      if (selectedTags.length > 0) {
        const { error: insertTagsError } = await supabase.from('task_tags').insert(selectedTags.map(tag => ({ task_id: currentTaskId, tag_id: tag.id })))
        if (insertTagsError) console.error('AutoSave insert tags failed:', insertTagsError)
      }
      setTasks(prev => prev.map(t => t.id === currentTaskId ? { ...t, ...taskData, tags: selectedTags } : t))
    } catch (e) {
      console.error('AutoSave error:', e)
    } finally {
      setTimeout(() => setIsSaving(false), 500)
    }
  }, [currentTaskId, title, description, subtasks, priority, dueDate, dueTime, dueTimeEnd, duration, selectedTags, listId])

  useEffect(() => {
    if ((isModalOpen || isPanelOpen) && modalMode === 'edit') autoSave()
  }, [debouncedTitle, debouncedDescription, debouncedPriority, debouncedDueDate, debouncedDueTime, debouncedDueTimeEnd, debouncedDuration, debouncedTags, debouncedListId])

  // --- SYNC LOCAL STATE WITH TASKS (ONLY ON TASK SWITCH OR EXTERNAL UPDATE) ---
  useEffect(() => {
    if ((isModalOpen || isPanelOpen) && currentTaskId) {
      const task = tasks.find(t => t.id === currentTaskId)
      if (task) {
        const taskDueDate = task.due_date || ''
        const taskEndDate = task.end_date || task.due_date || ''
        const taskDueTime = task.due_time ? task.due_time.substring(0, 5) : ''
        const taskDueTimeEnd = task.end_time ? task.end_time.substring(0, 5) : ''

        // IMPORTANT: Only sync back from the Global Tasks array if we are NOT in the middle of a local save
        if (!isSaving) {
          if (taskDueDate !== dueDate || taskDueTime !== dueTime || taskEndDate !== endDate || taskDueTimeEnd !== dueTimeEnd) {
            setDueDate(taskDueDate)
            setDueTime(taskDueTime)
            setEndDate(taskEndDate)
            setDueTimeEnd(taskDueTimeEnd)

            if (task.due_time && task.end_time && task.due_date && task.end_date) {
              const start = new Date(`${task.due_date}T${task.due_time}`)
              const end = new Date(`${task.end_date}T${task.end_time}`)
              setDuration(Math.round((end - start) / 60000))
            } else {
              setDuration(60)
            }
          }
        }
      }
    }
  }, [currentTaskId, tasks]) // Sync when task changes OR when tasks are refetched from server

  // --- БЛОКИРОВКА ОБНОВЛЕНИЯ И ИСТОРИЯ ---
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overscrollBehaviorY = 'contain'
      document.body.style.overflow = 'hidden'
      window.history.pushState({ modalOpen: true }, '')
    } else {
      document.body.style.overscrollBehaviorY = 'auto'
      document.body.style.overflow = 'auto'
    }
    const handlePopState = () => { if (isModalOpen) closeModal(true); }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isModalOpen])

  // --- GLOBAL EVENT LISTENERS FOR DRAG/RESIZE (MOUSE + TOUCH) ---
  useEffect(() => {
    function handleMove(e) {
      const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY
      const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX

      const resizingState = resizingTaskStateRef.current
      const movingState = movingTaskStateRef.current

      // Safety check: if mouse button released outside, cancel/commit
      if ((resizingState || isResizingSidebar.current || isResizingPanel.current) && !e.type.includes('touch') && e.buttons === 0) {
        handleEnd(e)
        return
      }

      // RESIZING
      if (resizingState) {
        const container = document.getElementById('week-view-container')
        if (container) {
          const rect = container.getBoundingClientRect()
          const deltaY = clientY - resizingState.startY
          const deltaMinutes = (deltaY / rect.height) * 1440
          const rawDuration = resizingState.originalDuration + deltaMinutes
          const newDuration = Math.max(15, Math.floor(rawDuration / 15) * 15)
          setResizingTaskState(prev => ({ ...prev, currentDuration: newDuration }))
        }
      }

      // MOVING (TOUCH)
      if (movingState) {
        if (e.cancelable) e.preventDefault() // Stop scrolling!

        // DIRECT DOM MANIPULATION (No React State Update)
        const currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
        const currentY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY

        // Update Ref for handleEnd to use later
        movingState.currentX = currentX
        movingState.currentY = currentY

        const el = document.getElementById(`calendar-task-${movingState.id}`)
        if (el) {
          const deltaX = currentX - movingState.startX
          const deltaY = currentY - movingState.startY
          el.style.transform = `translate(${deltaX}px, ${deltaY}px)`
        }
      }

      // SIDEBAR / PANEL RESIZE (Mouse mostly)
      if (isResizingSidebar.current) {
        // ... (as before)
        const minWidth = window.innerWidth * 0.1
        const maxWidth = window.innerWidth * 0.3
        const newWidth = Math.max(minWidth, Math.min(maxWidth, clientX))
        setSidebarWidth(newWidth)
      }
      if (isResizingPanel.current) {
        if (e.cancelable) e.preventDefault()
        const minWidth = 300
        const maxWidth = 800
        // Calculate width based on whether Calendar is also open
        const rightOffset = isCalendarPanelOpen ? calendarWidth : 0
        const totalRightWidth = window.innerWidth - clientX
        const newWidth = Math.max(minWidth, Math.min(maxWidth, totalRightWidth - rightOffset))
        setPanelWidth(newWidth)
      }
      if (isResizingCalendar.current) {
        if (e.cancelable) e.preventDefault()
        const minWidth = 250
        const maxWidth = 600
        const newWidth = Math.max(minWidth, Math.min(maxWidth, window.innerWidth - clientX))
        setCalendarWidth(newWidth)
      }
    }

    async function handleEnd(e) { // MouseUp or TouchEnd
      const resizingState = resizingTaskStateRef.current
      const movingState = movingTaskStateRef.current

      if (resizingState) {
        // Commit Resize
        const task = tasks.find(t => t.id === resizingState.id)
        if (task && task.due_date) {
          // Correctly include time in start date
          const start = new Date(`${task.due_date}T${task.due_time || '00:00:00'}`)
          const duration = resizingState.currentDuration
          const end = new Date(start.getTime() + duration * 60000)

          const end_date = format(end, 'yyyy-MM-dd')
          const end_time = format(end, 'HH:mm:ss')

          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, end_date, end_time } : t))
          const { error: resizeError } = await supabase.from('tasks').update({ end_date, end_time }).eq('id', task.id)
          if (resizeError) console.error('Resize update failed:', resizeError)
        }
        setResizingTaskState(null)
      }

      if (movingState) {
        // Commit Move

        // 1. Check for All-Day Drop
        const allDayRow = document.getElementById('all-day-row')
        if (allDayRow) {
          const rect = allDayRow.getBoundingClientRect()
          const currentY = movingState.currentY
          if (currentY >= rect.top && currentY <= rect.bottom) {
            const task = tasks.find(t => t.id === movingState.id)
            if (task) {
              const dayDate = new Date(movingState.startDayStr)
              onDropTaskOnCalendar(task.id, dayDate, 'all-day')
            }
            // Cleanup
            const el = document.getElementById(`calendar-task-${movingState.id}`)
            if (el) el.style.transform = ''
            setMovingTaskState(null)
            isResizingSidebar.current = false
            isResizingPanel.current = false
            document.body.style.cursor = 'default'
            document.body.style.userSelect = 'auto'
            document.body.classList.remove('resizing')
            return
          }
        }

        // 2. Week View Grid Drop
        const container = document.getElementById('week-view-container')
        if (container) {
          const rect = container.getBoundingClientRect()
          // Use Ref values as State is not updated during move
          const currentY = movingState.currentY || movingState.startY
          const currentX = movingState.currentX || movingState.startX

          const deltaY = currentY - movingState.startY

          // Current Time (Minutes)
          const [h, m] = movingState.originalTime.split(':').map(Number)
          const originalMinutes = h * 60 + m

          // Delta Minutes
          const displayedHoursCount = isNightHidden ? 15 : 24
          const deltaMinutes = (deltaY / rect.height) * (displayedHoursCount * 60)

          const newTotalMinutes = originalMinutes + deltaMinutes

          // Helper to snap
          const snapped = Math.max(0, Math.min(1439, Math.round(newTotalMinutes / 30) * 30))
          const newH = Math.floor(snapped / 60)
          const newM = snapped % 60
          // Force HH:mm:ss format
          const timeStr = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:00`

          // Calculate Day Column
          let targetDayDate = new Date(movingState.startDayStr) // fallback
          if (currentX && movingState.startX) {
            const relativeX = currentX - rect.left
            if (relativeX > 60) {
              const dayWidth = (rect.width - 60) / calendarDays
              const colIndex = Math.floor((relativeX - 60) / dayWidth)

              if (colIndex >= 0 && colIndex < calendarDays) {
                let startDate
                if (calendarDays === 7) {
                  startDate = startOfWeek(currentCalendarDate, { weekStartsOn: 1 })
                } else {
                  startDate = currentCalendarDate
                }
                targetDayDate = addDays(startDate, colIndex)
              }
            }
          }

          const task = tasks.find(t => t.id === movingState.id)
          if (task) {
            onDropTaskOnCalendar(task.id, targetDayDate, timeStr.substring(0, 5))
          }
        }

        // Cleanup DOM transform
        const el = document.getElementById(`calendar-task-${movingState.id}`)
        if (el) el.style.transform = ''

        setMovingTaskState(null)
      }

      isResizingSidebar.current = false
      isResizingPanel.current = false
      isResizingCalendar.current = false
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
      document.body.classList.remove('resizing')
    }

    // Add listeners using CAPTURE for mouse events
    window.addEventListener('mousemove', handleMove, { capture: true })
    window.addEventListener('mouseup', handleEnd, { capture: true })
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleEnd)

    return () => {
      window.removeEventListener('mousemove', handleMove, { capture: true })
      window.removeEventListener('mouseup', handleEnd, { capture: true })
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [isNightHidden, tasks, onDropTaskOnCalendar, calendarDays, currentCalendarDate]) // removed resizingTaskState, movingTaskState from deps to avoid re-binding during drag

  // --- UI HELPERS ---
  const closeModal = (fromPopState = false) => {
    if (isAnimatingOut) return
    setIsAnimatingOut(true)
    setDragOffset(window.innerHeight)
    setTimeout(() => {
      setIsModalOpen(false)
      setIsAnimatingOut(false)
      setDragOffset(0)
      if (!fromPopState && window.history.state?.modalOpen) window.history.back()
    }, 300)
  }

  const handleTouchStart = (e) => {
    if (isAnimatingOut) return
    const scrollContainer = e.currentTarget.querySelector('.modal-scroll-area')
    if (scrollContainer && scrollContainer.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      setIsDragging(true)
    }
  }

  const handleTouchMove = (e) => {
    if (!isDragging || isAnimatingOut) return
    const currentY = e.touches[0].clientY
    const deltaY = currentY - startY.current
    if (deltaY > 0) {
      setDragOffset(Math.pow(deltaY, 0.95))
      if (deltaY > 5 && e.cancelable) e.preventDefault()
    }
  }

  const handleTouchEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragOffset > 100) closeModal()
    else setDragOffset(0)
  }

  const openTaskDetail = (task, mode = 'panel') => {
    setModalMode('edit');
    setCurrentTaskId(task.id);
    setTitle(task.title || '');
    setDescription(task.description || '')
    setSubtasks(task.subtasks || [])
    setPriority(task.priority || 'low');

    setDueDate(task.due_date || '');
    setEndDate(task.end_date || task.due_date || '');
    setDueTime(task.due_time ? task.due_time.substring(0, 5) : '');
    setDueTimeEnd(task.end_time ? task.end_time.substring(0, 5) : '');

    if (task.due_time && task.end_time && task.due_date && task.end_date) {
      const start = new Date(`${task.due_date}T${task.due_time}`)
      const end = new Date(`${task.end_date}T${task.end_time}`)
      setDuration(Math.round((end - start) / 60000))
    } else {
      setDuration(60)
    }

    setListId(task.list_id || null);
    setSelectedTags(task.tags || []);

    if (mode === 'panel') {
      setIsPanelOpen(true);
    } else {
      setIsModalOpen(true);
      setIsPanelOpen(false);
    }
  }

  const getHeaderTitle = () => {
    if (dateFilter === 'today') return "Сегодня"
    if (dateFilter === 'tomorrow') return "Завтра"
    if (selectedListId) return allLists.find(l => l.id === selectedListId)?.name || "Проект"
    if (selectedTagId) return allTags.find(t => t.id === selectedTagId)?.name || "Метка"
    return "Входящие"
  }

  // --- ACTIONS ---
  async function saveTask(customTitle = null) {
    const finalTitle = customTitle || title
    if (!finalTitle.trim()) return

    const taskData = {
      title: finalTitle.trim(),
      description: customTitle ? '' : (description || ''),
      priority: customTitle ? 'low' : (priority || 'low'),
      due_date: customTitle ? null : (dueDate || null),
      due_time: (customTitle || !dueTime) ? null : `${dueTime}:00`,
      end_date: customTitle ? null : (endDate || dueDate || null),
      end_time: (customTitle || !dueTimeEnd) ? null : `${dueTimeEnd}:00`,
      list_id: customTitle ? selectedListId : (listId || selectedListId)
    }

    if (modalMode === 'create' || customTitle) {
      const { data, error } = await supabase.from('tasks').insert([taskData]).select()
      if (error) {
        console.error('Insert failed:', error)
        // Try fallback without end_date if it failed
        const { end_date, ...fallbackData } = taskData
        const { data: fData, error: fError } = await supabase.from('tasks').insert([fallbackData]).select()
        if (fError) console.error('Total insert failure:', fError)
      }
      if (data && selectedTags.length > 0 && !customTitle) {
        await supabase.from('task_tags').insert(selectedTags.map(tag => ({ task_id: data[0].id, tag_id: tag.id })))
      }
    } else {
      try {
        await autoSave()
      } catch (err) {
        console.error('AutoSave failed:', err)
      }
    }

    if (isModalOpen) closeModal()
    fetchData(true)
  }

  async function handleAddConfirm() {
    if (!newName.trim()) return
    if (addMode === 'folder') {
      await supabase.from('folders').insert([{ name: newName.trim() }])
    } else {
      await supabase.from('lists').insert([{ name: newName.trim(), folder_id: targetFolderId || null }])
    }
    setNewName('')
    setTargetFolderId('')
    setIsAddPopupOpen(false)
    fetchData(true)
  }

  async function createTag() {
    if (!newTagName.trim()) return;
    await supabase.from('tags').insert([{ name: newTagName.trim() }]);
    setNewTagName('');
    fetchData(true);
  }

  async function deleteTask(id) {
    if (confirm('Удалить эту задачу?')) {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) {
        console.error('Delete failed:', error)
      } else {
        setTasks(prev => prev.filter(t => t.id !== id))
        if (currentTaskId === id) {
          setCurrentTaskId(null)
          setIsModalOpen(false)
        }
      }
    }
  }

  async function toggleTask(id, isCompleted) {
    setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: !isCompleted } : t))
    await supabase.from('tasks').update({ is_completed: !isCompleted }).eq('id', id)
    fetchData(true)
  }

  async function createSubtask() {
    if (!currentTaskId) return;
    const parentTask = tasks.find(t => t.id === currentTaskId);
    if (!parentTask) return;

    const newSubtask = {
      title: 'Новая подзадача',
      parent_id: currentTaskId,
      list_id: parentTask.list_id,
      is_completed: false
    };

    // Optimistic update
    const tempId = 'temp-' + Date.now();
    setTasks(prev => [...prev, { ...newSubtask, id: tempId, created_at: new Date().toISOString() }]);

    const { data, error } = await supabase.from('tasks').insert([newSubtask]).select();
    if (error) {
      console.error('Failed to create subtask:', error);
      setTasks(prev => prev.filter(t => t.id !== tempId)); // Revert
    } else if (data) {
      setTasks(prev => prev.map(t => t.id === tempId ? data[0] : t));
    }
  }

  async function handleDuplicateTask(taskId) {
    const taskToDuplicate = tasks.find(t => t.id === taskId);
    if (!taskToDuplicate) return;

    const { id, created_at, ...taskData } = taskToDuplicate;
    const newTask = { ...taskData, title: taskData.title + ' (Копия)', is_completed: false };

    // Optimistic
    const tempId = 'dup-' + Date.now();
    setTasks(prev => [...prev, { ...newTask, id: tempId, created_at: new Date().toISOString() }]);

    const { data, error } = await supabase.from('tasks').insert([newTask]).select();
    if (error) {
      console.error('Duplicate failed:', error);
      setTasks(prev => prev.filter(t => t.id !== tempId));
    } else if (data) {
      setTasks(prev => prev.map(t => t.id === tempId ? data[0] : t));
      // Also duplicate subtasks? User didn't ask explicitly, but usually yes. 
      // For now, let's keep it simple (shallow duplicate) or Complexity 10.
      // Shallow duplicate is safer for now to avoid complexity explosion.
    }
  }

  const handleContextMenu = (e, task) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      taskId: task.id
    });
  };

  // --- INLINE EDITING ---
  const handleTaskTitleBlur = async (task, newTitle) => {
    if (!newTitle.trim()) {
      setEditingTaskId(null)
      return
    }
    if (newTitle !== task.title) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, title: newTitle } : t));
      await supabase.from('tasks').update({ title: newTitle }).eq('id', task.id);
    }
    setEditingTaskId(null);
  }

  const handleTaskTitleKeyDown = (e, task) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  }

  const setFormatDate = (offsetDays) => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    setDueDate(d.toISOString().split('T')[0])
    setShowDatePicker(false)
  }

  const sidebarProps = {
    allFolders, allLists, allTags, tasks,
    selectedListId, selectedTagId, dateFilter,
    resetFilters: () => { setSelectedListId(null); setSelectedTagId(null); setDateFilter(null); },
    setSelectedListId, setSelectedTagId, setDateFilter, setActiveView, activeView,
    setIsSidebarOpen, collapsedFolders, toggleFolder: (id) => setCollapsedFolders(prev => ({ ...prev, [id]: !prev[id] })),
    setIsAddPopupOpen,
    newTagName, setNewTagName, createTag,
    deleteFolder: async (e, id) => { e.stopPropagation(); if (confirm('Удалить папку и все проекты в ней?')) { await supabase.from('folders').delete().eq('id', id); fetchData(true); } },
    deleteList: async (e, id) => { e.stopPropagation(); if (confirm('Удалить проект?')) { await supabase.from('lists').delete().eq('id', id); fetchData(true); } },
    deleteTag: async (e, id) => { e.stopPropagation(); if (confirm('Удалить метку?')) { await supabase.from('tags').delete().eq('id', id); fetchData(true); } },
    onDragStart: (e, id) => { e.dataTransfer.setData('listId', String(id)); e.dataTransfer.effectAllowed = 'move'; },
    onDrop: async (e, fid) => {
      e.preventDefault();
      const lid = e.dataTransfer.getData('listId');
      if (lid) {
        setAllLists(prev => prev.map(l => String(l.id) === String(lid) ? { ...l, folder_id: fid } : l))
        await supabase.from('lists').update({ folder_id: fid }).eq('id', lid);
        fetchData(true);
      }
    },
    onDropTask: async (e, targetListId) => {
      e.preventDefault()
      const taskId = e.dataTransfer.getData('taskId')
      if (taskId) {
        setTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, list_id: targetListId, parent_id: null } : t))
        await supabase.from('tasks').update({ list_id: targetListId, parent_id: null }).eq('id', taskId)
        fetchData(true)
      }
    },
    onDropTaskReorder: async (e, targetTaskId, position) => {
      e.preventDefault();
      const draggedTaskId = e.dataTransfer.getData('taskId');
      if (!draggedTaskId || String(draggedTaskId) === String(targetTaskId)) return;

      // 1. Identification of the context (filteredTasks) is crucial.
      // We should reorder within the CURRENT VIEW (filteredTasks).
      // However, filteredTasks isn't directly available in this scope easily without prop drilling or using state.
      // But we have 'tasks' state and we know the 'filteredTasks' logic is derived.
      // Better to re-index specifically the siblings that share the same List/Context.

      const draggedTask = tasks.find(t => String(t.id) === String(draggedTaskId));
      const targetTask = tasks.find(t => String(t.id) === String(targetTaskId));
      if (!targetTask || !draggedTask) return;

      // Identify Siblings scope:
      // If in a List -> list_id must match.
      // If in Inbox -> list_id is null.
      // If in Smart List (Today/Tomorrow) -> Date matches?
      // Reordering usually only makes sense within a static List context (Project or Inbox).
      // If user drops in 'Today' view, what does it mean? Order for today?
      // Let's assume reordering affects the 'order_index' globally, but we only re-index siblings sharing the same list_id.
      // If list_id differs (dragging to another list), that's handled by onDropTask, not Reorder.

      if (draggedTask.list_id !== targetTask.list_id) {
        // Fallback if somehow drag-n-drop reorder was triggered across lists (unlikely with current UI)
        return;
      }

      const scopeListId = targetTask.list_id;

      // Get siblings, sorted by current order
      const siblings = tasks
        .filter(t => t.list_id === scopeListId && !t.is_completed) // Reorder only active tasks usually
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || b.id - a.id);

      const dragIdx = siblings.findIndex(t => String(t.id) === String(draggedTaskId));
      const targetIdx = siblings.findIndex(t => String(t.id) === String(targetTaskId));

      if (targetIdx === -1) return;

      // Remove dragged from array
      const newSiblings = siblings.filter(t => String(t.id) !== String(draggedTaskId));

      // Calculate insert index
      let insertIndex = targetIdx;
      // If we removed the item from *before* the target, the target index shifted down by 1. 
      // But 'newSiblings' already has it removed.
      // We need to find the index of target in 'newSiblings'.
      const newTargetIndex = newSiblings.findIndex(t => String(t.id) === String(targetTaskId));

      if (position === 'bottom') {
        insertIndex = newTargetIndex + 1;
      } else {
        insertIndex = newTargetIndex;
      }

      newSiblings.splice(insertIndex, 0, draggedTask);

      // Re-index logic
      const updates = [];
      const newTasks = tasks.map(t => {
        const inScope = newSiblings.find(s => String(s.id) === String(t.id));
        if (inScope) {
          const idx = newSiblings.findIndex(s => String(s.id) === String(t.id));
          const newOrder = (idx + 1) * 10000;
          if (t.order_index !== newOrder) {
            updates.push({ id: t.id, order_index: newOrder });
          }
          return { ...t, order_index: newOrder };
        }
        return t;
      });

      // Optimistic Update
      setTasks(newTasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || b.id - a.id));

      if (updates.length > 0) {
        // Prepare batch update? Supabase doesn't strictly support large batch updates in one call easily without RPC.
        // But for <100 tasks it's okay to Promise.all or use upsert.
        // Upsert is better.
        const { error } = await supabase.from('tasks').upsert(updates.map(u => ({ id: u.id, order_index: u.order_index })));
        if (error) console.error('Reorder failed:', error);
      }
      fetchData(true);
    },
    dragOverTaskId, setDragOverTaskId,
    dropPosition, setDropPosition,
    onDragStartFolder: (e, id) => {
      e.dataTransfer.setData('folderId', String(id))
      e.dataTransfer.effectAllowed = 'move'
    },
    onDropFolderSorting: async (e, targetId, position = 'bottom') => {
      e.preventDefault()
      const draggedId = e.dataTransfer.getData('folderId')
      if (!draggedId || String(draggedId) === String(targetId)) return

      const allFoldersSorted = [...allFolders].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      const draggedFolder = allFoldersSorted.find(f => String(f.id) === String(draggedId));
      if (!draggedFolder) return;

      const siblings = allFoldersSorted.filter(f => String(f.id) !== String(draggedId));
      const targetIndex = siblings.findIndex(f => String(f.id) === String(targetId));
      if (targetIndex === -1) return;

      let insertIndex = targetIndex;
      if (position === 'bottom') insertIndex = targetIndex + 1;

      const newSiblings = [...siblings];
      newSiblings.splice(insertIndex, 0, draggedFolder);

      const updates = [];
      const newFolders = allFolders.map(f => {
        const inNewOrder = newSiblings.find(s => String(s.id) === String(f.id));
        if (inNewOrder) {
          const idx = newSiblings.findIndex(s => String(s.id) === String(f.id));
          const newOrderIndex = (idx + 1) * 10000;
          if (f.order_index !== newOrderIndex) {
            updates.push({ id: f.id, order_index: newOrderIndex });
          }
          return { ...f, order_index: newOrderIndex };
        }
        return f;
      });

      setAllFolders(newFolders.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));

      if (updates.length > 0) {
        await Promise.all(updates.map(u => supabase.from('folders').update({ order_index: u.order_index }).eq('id', u.id)));
      }
      fetchData(true)
    },
    onDragStartList: (e, id) => {
      e.dataTransfer.setData('listIdForSort', String(id))
      e.dataTransfer.setData('listId', String(id)) // For compatibility with list-to-folder
      e.dataTransfer.effectAllowed = 'move'
    },
    onDropListSorting: async (e, targetId, position = 'bottom') => {
      e.preventDefault()
      const draggedId = e.dataTransfer.getData('listIdForSort')
      if (!draggedId || String(draggedId) === String(targetId)) return

      const draggedList = allLists.find(l => String(l.id) === String(draggedId))
      const targetList = allLists.find(l => String(l.id) === String(targetId))
      if (!draggedList || !targetList) return

      const targetFolderId = targetList.folder_id

      // Filter siblings in the same folder (or root) and sort them by current order
      const siblings = allLists
        .filter(l => l.folder_id === targetFolderId && String(l.id) !== String(draggedId))
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))

      const targetIndex = siblings.findIndex(l => String(l.id) === String(targetId))
      if (targetIndex === -1) return

      let insertIndex = targetIndex
      if (position === 'bottom') insertIndex = targetIndex + 1

      const newSiblings = [...siblings]
      const updatedDraggedList = { ...draggedList, folder_id: targetFolderId }
      newSiblings.splice(insertIndex, 0, updatedDraggedList)

      const updates = []
      const newAllLists = allLists.map(l => {
        const inNewOrder = newSiblings.find(s => String(s.id) === String(l.id))
        if (inNewOrder) {
          const idx = newSiblings.findIndex(s => String(s.id) === String(l.id))
          const newOrderIndex = (idx + 1) * 10000

          if (l.order_index !== newOrderIndex || l.folder_id !== targetFolderId) {
            updates.push({ id: l.id, order_index: newOrderIndex, folder_id: targetFolderId })
          }
          return { ...l, order_index: newOrderIndex, folder_id: targetFolderId }
        }
        return l
      })

      setAllLists(newAllLists.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)))

      if (updates.length > 0) {
        await Promise.all(updates.map(u =>
          supabase.from('lists').update({ order_index: u.order_index, folder_id: u.folder_id }).eq('id', u.id)
        ))
      }
      fetchData(true)


      fetchData(true)
      fetchData(true)
    },
    hoveredListId, setHoveredListId,
    dragOverListInfo, setDragOverListInfo,
    dragOverFolderInfo, setDragOverFolderInfo,
    fetchData
  }

  const sortedTasks = [...tasks].filter(task => {
    const matchesSearch = !searchQuery ||
      (task.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesList = selectedListId ? task.list_id === selectedListId : (dateFilter || selectedTagId ? true : task.list_id === null)
    const matchesTag = !selectedTagId || (task.tags && task.tags.some(tag => tag.id === selectedTagId))
    const taskDate = task.due_date ? task.due_date.split('T')[0] : null
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    let matchesDate = true
    if (dateFilter === 'today') matchesDate = taskDate === today
    if (dateFilter === 'tomorrow') matchesDate = taskDate === tomorrow
    return matchesSearch && matchesTag && matchesList && matchesDate
  }).sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title)
    if (sortBy === 'date') {
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date) - new Date(b.due_date)
    }
    if (sortBy === 'tag') {
      const tagA = a.tags?.[0]?.name || ''
      const tagB = b.tags?.[0]?.name || ''
      return tagA.localeCompare(tagB)
    }
    return (a.order_index || 0) - (b.order_index || 0) || a.id - b.id
  })

  const getGroupedTasks = () => {
    if (groupBy === 'none') return [{ name: null, tasks: sortedTasks }]
    const groups = {}
    sortedTasks.forEach(task => {
      let key = 'Без группы'
      if (groupBy === 'priority') {
        key = task.priority === 'high' ? '🚩 Важные' : '🏁 Обычные'
      } else if (groupBy === 'date') {
        if (!task.due_date) key = 'Без даты'
        else {
          const d = new Date(task.due_date).toLocaleDateString()
          const today = new Date().toLocaleDateString()
          const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString()
          if (d === today) key = 'Сегодня'
          else if (d === tomorrow) key = 'Завтра'
          else key = d
        }
      }
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    })
    return Object.entries(groups).map(([name, tasks]) => ({ name, tasks }))
  }

  const groupedTasks = getGroupedTasks()

  return (
    <div className="h-screen bg-white flex font-sans text-[#333] overflow-hidden selection:bg-indigo-100 relative">
      {!isCalendarPanelOpen && (
        <button
          onClick={() => setIsCalendarPanelOpen(true)}
          className="hidden lg:flex fixed top-4 right-4 w-10 h-10 flex-col justify-center items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-lg group z-[100]"
          title="Открыть расписание"
        >
          <div className="w-5 h-0.5 bg-slate-400 group-hover:bg-indigo-500 transition-colors rounded-full"></div>
          <div className="w-5 h-0.5 bg-slate-400 group-hover:bg-indigo-500 transition-colors rounded-full"></div>
          <div className="w-5 h-0.5 bg-slate-400 group-hover:bg-indigo-500 transition-colors rounded-full"></div>
        </button>
      )}

      {/* SIDEBAR - DESKTOP */}
      <aside
        style={{ width: `${sidebarWidth}px` }}
        className="hidden md:block flex-shrink-0 sticky top-0 h-screen overflow-hidden group/sidebar"
      >
        <SidebarContent {...sidebarProps} />
        {/* Resize Handle Sidebar */}
        <div
          onMouseDown={(e) => {
            isResizingSidebar.current = true
            document.body.style.cursor = 'ew-resize'
            document.body.style.userSelect = 'none'
            document.body.classList.add('resizing')
          }}
          className="absolute top-0 right-[-4px] w-2 h-full cursor-ew-resize hover:bg-indigo-500/50 transition-colors z-50 group-hover/sidebar:bg-slate-200"
        />
      </aside>

      {/* DRAWER - MOBILE */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-[60] transform transition duration-300 ease-in-out md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent {...sidebarProps} />
      </div>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-[55] md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* MAIN VIEW */}
      <main className="flex-1 h-full flex flex-col items-stretch overflow-hidden relative">
        <div className={`${activeView === 'calendar' ? 'max-w-none p-0' : 'max-w-4xl px-2 py-4 md:px-6 md:py-8'} w-full mx-auto md:mx-0 flex flex-col flex-1 transition-all duration-500 overflow-hidden`}>
          <header className={`flex justify-between items-center ${activeView === 'calendar' ? 'px-6 py-2 border-b border-slate-50' : 'mb-6'} gap-2`}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden w-8 h-8 flex flex-col justify-center items-center gap-1 hover:bg-slate-100 rounded-lg transition active:scale-90">
                <div className="w-5 h-0.5 bg-slate-600 rounded-full"></div>
                <div className="w-5 h-0.5 bg-slate-600 rounded-full"></div>
                <div className="w-5 h-0.5 bg-slate-600 rounded-full"></div>
              </button>
              <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
                <span className="text-slate-300">≡</span>
                {activeView === 'calendar' ? (
                  (() => {
                    if (calendarDays === 1) return format(currentCalendarDate, 'd MMM yyyy', { locale: ru })
                    let start, end
                    if (calendarDays === 3) {
                      start = currentCalendarDate
                      end = addDays(currentCalendarDate, 2)
                    } else {
                      start = startOfWeek(currentCalendarDate, { weekStartsOn: 1 })
                      end = endOfWeek(currentCalendarDate, { weekStartsOn: 1 })
                    }
                    return `${format(start, 'd MMM', { locale: ru })} - ${format(end, 'd MMM yyyy', { locale: ru })}`
                  })()
                ) : getHeaderTitle()}
              </h1>
              {/* Mobile Calendar Toggle */}
              <button
                onClick={() => setActiveView(activeView === 'tasks' ? 'calendar' : 'tasks')}
                className="md:hidden w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full ml-auto"
              >
                <span className="text-sm">{activeView === 'tasks' ? '📅' : '📋'}</span>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-300 pointer-events-none text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-slate-50 border-none rounded-full pl-8 pr-4 py-1.5 text-xs w-32 md:w-48 focus:w-64 focus:bg-white focus:ring-1 focus:ring-slate-200 transition-all outline-none font-medium placeholder:text-slate-300"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-slate-300 hover:text-slate-500 transition text-[10px]"
                  >✕</button>
                )}
              </div>
              {activeView === 'calendar' && (
                <div className="flex items-center">
                  {/* <button onClick={() => setIsNightHidden(!isNightHidden)} className={`mr-4 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border transition ${isNightHidden ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                    {isNightHidden ? '🌙 Ночь скрыта' : '☀️ Показать все'}
                  </button> */}
                  <div className="flex p-1 bg-slate-100 rounded-xl mr-4 h-8">
                    <button onClick={() => {
                      if (calendarDays === 1) setCurrentCalendarDate(subDays(currentCalendarDate, 1))
                      else if (calendarDays === 3) setCurrentCalendarDate(subDays(currentCalendarDate, 3))
                      else setCurrentCalendarDate(subWeeks(currentCalendarDate, 1))
                    }} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded-lg transition text-xs">←</button>
                    <button onClick={() => setCurrentCalendarDate(new Date())} className="px-2 py-0.5 text-[9px] font-black uppercase hover:bg-white rounded-lg transition mx-1">Сегодня</button>
                    <button onClick={() => {
                      if (calendarDays === 1) setCurrentCalendarDate(addDays(currentCalendarDate, 1))
                      else if (calendarDays === 3) setCurrentCalendarDate(addDays(currentCalendarDate, 3))
                      else setCurrentCalendarDate(addWeeks(currentCalendarDate, 1))
                    }} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded-lg transition text-xs">→</button>
                  </div>
                  {/* View Switcher for Calendar */}
                  <div className="flex bg-slate-100 rounded-xl p-0.5 h-8 mr-2">
                    <button onClick={() => setCalendarDays(1)} className={`px-2 text-[10px] font-bold rounded-lg transition ${calendarDays === 1 ? 'bg-white shadow-sm text-black' : 'text-slate-400 hover:text-slate-600'}`}>1</button>
                    <button onClick={() => setCalendarDays(3)} className={`px-2 text-[10px] font-bold rounded-lg transition ${calendarDays === 3 ? 'bg-white shadow-sm text-black' : 'text-slate-400 hover:text-slate-600'}`}>3</button>
                    <button onClick={() => setCalendarDays(7)} className={`px-2 text-[10px] font-bold rounded-lg transition ${calendarDays === 7 ? 'bg-white shadow-sm text-black' : 'text-slate-400 hover:text-slate-600'}`}>7</button>
                  </div>
                </div>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg transition ${showSortMenu || sortBy !== 'order' || groupBy !== 'none' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-black'}`}
                >
                  ⇅ Сортировка
                </button>
                {showSortMenu && (
                  <>
                    <div className="fixed inset-0 z-[105]" onClick={() => setShowSortMenu(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-[110] animate-in zoom-in-95 duration-200">
                      <div className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-300 tracking-tighter border-b border-slate-50 mb-1">Сортировать по</div>
                      <button onClick={() => { setSortBy('order'); setShowSortMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition ${sortBy === 'order' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>Вручную</button>
                      <button onClick={() => { setSortBy('title'); setShowSortMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition ${sortBy === 'title' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>Названию</button>
                      <button onClick={() => { setSortBy('date'); setShowSortMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition ${sortBy === 'date' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>Дате</button>
                      <button onClick={() => { setSortBy('tag'); setShowSortMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition ${sortBy === 'tag' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>Метке</button>

                      <div className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-300 tracking-tighter border-b border-slate-50 my-1">Группировать по</div>
                      <button onClick={() => { setGroupBy('none'); setShowSortMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition ${groupBy === 'none' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>Нет</button>
                      <button onClick={() => { setGroupBy('priority'); setShowSortMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition ${groupBy === 'priority' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>Приоритету</button>
                      <button onClick={() => { setGroupBy('date'); setShowSortMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition ${groupBy === 'date' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>Дате</button>
                    </div>
                  </>
                )}
              </div>
              <button className="text-slate-400 hover:text-black transition">•••</button>
            </div>
          </header>

          {activeView === 'tasks' ? (
            <>
              <div className="mb-4">
                <input type="text" placeholder="+ Новая задача" className="w-full text-[15px] placeholder:text-slate-300 border-none bg-[#F4F4F4] rounded-lg px-4 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-slate-200 transition font-sans"
                  onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { saveTask(e.target.value); e.target.value = ''; } }} />
              </div>

              <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                {loading && tasks.length === 0 ? (
                  <div className="text-center py-20 text-slate-300 text-sm">Обновление...</div>
                ) : sortedTasks.length === 0 ? (
                  <div className="py-24 flex flex-col items-center opacity-20">
                    <span className="text-6xl mb-4">🎑</span>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Список пуст</p>
                  </div>
                ) : (
                  <div className="space-y-6"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      const taskId = e.dataTransfer.getData('taskId');
                      if (taskId) onRemoveParent(taskId);
                    }}>

                    {groupedTasks.map((group, gIdx) => {
                      const isTopLevel = (t) => (!t.parent_id || !group.tasks.some(pt => pt.id === t.parent_id));
                      const activeTasks = group.tasks.filter(t => !t.is_completed && isTopLevel(t));
                      const completedTasks = group.tasks.filter(t => t.is_completed && isTopLevel(t));

                      // Toggle state for this specific group's completed section
                      // We'll use a local state emulator or modify App state.
                      // Since we can't maintain state inside this map easily without a component,
                      // we'll default to 'open' or use the global state 'collapsedGroups' logic for now?
                      // User wanted the button at the BOTTOM.
                      // We'll use the 'collapsedFolders' state to track completed visibility per group index?
                      // Or just always show?
                      // Let's use a dummy toggle for now -> actually we need state.
                      // We'll use the 'collapsedFolders' with a prefix like 'completed-GROUPNAME' to track state.
                      const groupKey = `completed-${gIdx}`;
                      const isCompletedOpen = collapsedFolders[groupKey]; // Default false/undefined -> Collapsed? User said "collapsed list".
                      // Let's make it collapsed by default (undefined = false).

                      const renderTaskItem = (task) => {
                        const hasSubtasks = group.tasks.some(st => st.parent_id === task.id);
                        const isExpanded = expandedTaskIds[task.id];

                        return (
                          <div key={task.id}>
                            <div
                              style={{
                                transform: swipeTaskId === task.id ? `translateX(${swipeOffset}px)` : 'none',
                                transition: swipeTaskId === task.id ? 'none' : 'transform 0.2s ease-out'
                              }}
                              className={`group flex items-center gap-0 min-h-[2.5rem] border-b border-slate-50 transition-all duration-700 ease-in-out relative hover:bg-slate-50
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
                                setDragOverTaskId(null);
                                setDropPosition(null);
                              }}
                              onDrop={e => {
                                e.stopPropagation();
                                const draggedId = e.dataTransfer.getData('taskId');
                                if (draggedId) {
                                  if (dragOverTaskId && dropPosition) {
                                    sidebarProps.onDropTaskReorder(e, dragOverTaskId, dropPosition);
                                  } else if (dragOverTaskId) {
                                    onDropTaskOnTask(draggedId, task.id)
                                  }
                                }
                                setDragOverTaskId(null);
                                setDropPosition(null);
                              }}
                              onClick={(e) => {
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
                                onDragEnd={(e) => {
                                  setDropPosition(null);
                                }}
                              >⋮⋮</div>

                              {/* TOGGLE ARROW */}
                              {hasSubtasks ? (
                                <div onClick={(e) => { e.stopPropagation(); setExpandedTaskIds(prev => ({ ...prev, [task.id]: !prev[task.id] })); }} className="w-4 h-full flex items-center justify-center cursor-pointer text-slate-300 hover:text-indigo-600 z-10">
                                  <span className={`text-[8px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                </div>
                              ) : (
                                <div className="w-4"></div>
                              )}

                              <div onClick={(e) => handleTaskCompletion(e, task)}
                                className={`w-5 h-5 rounded border transition-all duration-200 shrink-0 flex items-center justify-center cursor-pointer mr-2 ${task.is_completed ? 'bg-slate-200 border-slate-200' : 'border-slate-300 hover:border-slate-500'}`}>
                                {task.is_completed && <span className="text-[#666] text-[10px] font-bold">✓</span>}
                              </div>

                              <div className="flex-1 min-w-0">
                                {editingTaskId === task.id ? (
                                  <input
                                    autoFocus
                                    className="w-full bg-transparent border-none outline-none p-0 text-[15px] leading-tight font-sans text-slate-700"
                                    defaultValue={task.title}
                                    onFocus={() => openTaskDetail(task, 'panel')}
                                    onBlur={(e) => handleTaskTitleBlur(task, e.target.value)}
                                    onKeyDown={(e) => handleTaskTitleKeyDown(e, task)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <p
                                    className={`leading-tight transition cursor-text truncate ${task.is_completed ? 'line-through text-slate-400' : 'text-[#333]'} ${hasSubtasks ? 'uppercase font-bold tracking-wide text-xs' : 'text-[15px]'}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTaskId(task.id);
                                      openTaskDetail(task, 'panel');
                                    }}
                                  >
                                    {(task.title || '').match(/https?:\/\/[^\s]+/) ? (
                                      <span dangerouslySetInnerHTML={{
                                        __html: (task.title || '').replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-indigo-600 hover:underline" onclick="event.stopPropagation()">$1</a>')
                                      }} />
                                    ) : (task.title || '')}
                                  </p>
                                )}

                                {(task.due_date || (task.tags && task.tags.length > 0)) && (
                                  <div className="flex flex-wrap gap-2 mt-1 text-[11px] font-medium text-slate-400 cursor-pointer" onClick={() => openTaskDetail(task, 'panel')}>
                                    {task.due_date && <span>📅 {new Date(task.due_date).toLocaleDateString()}</span>}
                                    {task.tags?.map(t => <span key={t.id} className="text-slate-300">#{t.name}</span>)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Render Subtasks (Collapsible) */}
                            {isExpanded && (
                              <div className="animate-in slide-in-from-top-1 duration-200">
                                {group.tasks.filter(st => st.parent_id && task.id && String(st.parent_id) === String(task.id)).map(subtask => (
                                  <div key={subtask.id}>
                                    <div
                                      draggable="true"
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData('taskId', subtask.id);
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.currentTarget.classList.add('opacity-30');
                                        setDraggedTaskId(subtask.id);
                                      }}
                                      onDragEnd={(e) => {
                                        e.currentTarget.classList.remove('opacity-30');
                                        setDraggedTaskId(null);
                                      }}
                                      onTouchStart={(e) => handleTaskTouchStart(e, subtask.id)}
                                      onTouchMove={(e) => handleTaskTouchMove(e, subtask.id)}
                                      onTouchEnd={() => handleTaskTouchEnd(subtask.id)}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.innerWidth >= 1024) {
                                          openTaskDetail(subtask, 'panel');
                                        } else {
                                          openTaskDetail(subtask, 'modal');
                                        }
                                      }}
                                      onContextMenu={(e) => handleContextMenu(e, subtask)}
                                      style={{
                                        transform: swipeTaskId === subtask.id ? `translateX(${swipeOffset}px)` : 'none',
                                        transition: swipeTaskId === subtask.id ? 'none' : 'transform 0.2s ease-out'
                                      }}
                                      className={`group flex items-start gap-2 py-2 border-b border-slate-50/50 cursor-pointer hover:bg-slate-50/30 transition-colors ml-8 relative
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
                                          sidebarProps.onDropTaskReorder(e, dragOverTaskId, dropPosition);
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

                                      <div onClick={(e) => { e.stopPropagation(); toggleTask(subtask.id, subtask.is_completed); }}
                                        className={`mt-0.5 w-4 h-4 rounded border transition-all duration-200 shrink-0 flex items-center justify-center ${subtask.is_completed ? 'bg-slate-100 border-slate-100' : 'border-slate-200 hover:border-slate-400'}`}>
                                        {subtask.is_completed && <span className="text-slate-400 text-[8px] font-bold">✓</span>}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm leading-tight transition truncate ${subtask.is_completed ? 'line-through text-slate-300' : 'text-slate-600'}`}>
                                          {subtask.title}
                                        </p>
                                      </div>
                                    </div>

                                    {/* LEVEL 3 SUBTASKS */}
                                    {group.tasks.filter(st3 => st3.parent_id && subtask.id && String(st3.parent_id) === String(subtask.id)).map(sub3 => (
                                      <div key={sub3.id}
                                        draggable="true"
                                        onContextMenu={(e) => handleContextMenu(e, sub3)}
                                        className="group flex items-start gap-2 py-2 border-b border-slate-50/50 cursor-pointer hover:bg-slate-50/30 transition-colors ml-16 relative"
                                        onClick={(e) => { e.stopPropagation(); openTaskDetail(sub3, 'panel'); }}
                                      >
                                        <div className="w-4"></div>
                                        <div onClick={(e) => { e.stopPropagation(); toggleTask(sub3.id, sub3.is_completed); }}
                                          className={`mt-0.5 w-3.5 h-3.5 rounded border transition-all duration-200 shrink-0 flex items-center justify-center ${sub3.is_completed ? 'bg-slate-100 border-slate-100' : 'border-slate-200 hover:border-slate-400'}`}>
                                          {sub3.is_completed && <span className="text-slate-400 text-[8px] font-bold">✓</span>}
                                        </div>
                                        <span className={`text-xs leading-tight transition truncate ${sub3.is_completed ? 'line-through text-slate-300' : 'text-slate-500'}`}>{sub3.title}</span>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      };
                      return (
                        <div key={gIdx} className="space-y-1">
                          {group.name && (
                            <div className="flex items-center gap-2 mb-3">
                              <div className="h-[1px] flex-1 bg-slate-100"></div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{group.name}</span>
                              <div className="h-[1px] flex-1 bg-slate-100"></div>
                            </div>
                          )}

                          {/* ACTIVE */}
                          {activeTasks.filter(t => !group.tasks.some(p => p.id === t.parent_id)).map(renderTaskItem)}

                          {/* COMPLETED SECTION (Button at Bottom) */}
                          {completedTasks.length > 0 && (
                            <div className="mt-auto pt-4 flex flex-col relative">

                              {isCompletedOpen && (
                                <div className="space-y-1 mb-2 pl-0 opacity-70 animate-in slide-in-from-top-2 duration-300">
                                  {completedTasks.filter(t => !group.tasks.some(p => p.id === t.parent_id)).map(renderTaskItem)}
                                </div>
                              )}

                              <button
                                onClick={() => setCollapsedFolders(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
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
                )
                }
              </div>
            </>
          ) : (
            <CalendarView
              tasks={tasks}
              currentDate={currentCalendarDate}
              setCurrentDate={setCurrentCalendarDate}
              selectedTaskId={selectedCalendarTaskId}
              onTaskClick={(task) => {
                if (!task) {
                  setSelectedCalendarTaskId(null)
                  return
                }
                if (selectedCalendarTaskId === task.id) {
                  openTaskDetail(task, 'panel')
                } else {
                  setSelectedCalendarTaskId(task.id)
                }
              }}
              onDropTaskOnCalendar={onDropTaskOnCalendar}
              resizingTaskState={resizingTaskState}
              handleTaskResizeStart={handleTaskResizeStart}
              hourHeight={hourHeight}
              setHourHeight={setHourHeight}
              isNightHidden={isNightHidden}
              setIsNightHidden={setIsNightHidden}
              calendarDays={calendarDays}
              movingTaskState={movingTaskState}
              handleCalendarTaskTouchStart={handleCalendarTaskTouchStart}
              handleCalendarTaskTouchMove={handleCalendarTaskTouchMove}
              handleCalendarTaskTouchEnd={handleCalendarTaskTouchEnd}
            />
          )}
        </div>
      </main >

      {/* RIGHT PANEL - DESKTOP */}
      {/* TASK DETAIL PANEL */}
      <aside
        style={{ width: `${panelWidth}px` }}
        className={`${activeView === 'calendar' ? 'hidden' : 'hidden lg:flex'} flex-col flex-shrink-0 border-l border-slate-100 bg-white sticky top-0 h-screen overflow-hidden animate-panel group/panel z-20 shadow-xl`}
        onClick={e => {
          // Close DatePicker if clicking outside of it (and outside the toggle button)
          if (showDatePicker &&
            datePickerRef.current && !datePickerRef.current.contains(e.target) &&
            (!datePickerBtnRef.current || !datePickerBtnRef.current.contains(e.target))) {
            setShowDatePicker(false);
          }
          // Close TagSelect if clicking outside
          if (showTagSelect &&
            tagSelectRef.current && !tagSelectRef.current.contains(e.target) &&
            (!tagSelectBtnRef.current || !tagSelectBtnRef.current.contains(e.target))) {
            setShowTagSelect(false);
          }
          // Close ProjectSelect if clicking outside
          if (showProjectSelect &&
            projectSelectRef.current && !projectSelectRef.current.contains(e.target) &&
            (!projectSelectBtnRef.current || !projectSelectBtnRef.current.contains(e.target))) {
            setShowProjectSelect(false);
          }
        }}
      >
        {/* Resize Handle Panel */}
        <div
          onMouseDown={() => {
            isResizingPanel.current = true
            document.body.style.cursor = 'ew-resize'
            document.body.style.userSelect = 'none'
            document.body.classList.add('resizing')
          }}
          className="absolute top-0 left-[-4px] w-2 h-full cursor-ew-resize hover:bg-indigo-500/50 transition-colors z-50 group-hover/panel:bg-slate-200"
        />

        {currentTaskId ? (
          <>
            <div className="flex flex-col h-full bg-white relative">
              {/* FIXED HEADER: Title & Meta */}
              <div className="p-6 border-b border-slate-100 flex-shrink-0 bg-white z-20 relative">
                {/* PARENT TASK BREADCRUMB */}
                {(() => {
                  const t = tasks.find(t => t.id === currentTaskId);
                  if (t && t.parent_id) {
                    const p = tasks.find(x => x.id === t.parent_id);
                    if (p) return (
                      <button onClick={() => openTaskDetail(p, 'panel')} className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3 cursor-pointer hover:text-indigo-600 flex items-center gap-1 transition-colors">
                        <span>↩</span>
                        <span className="truncate max-w-[300px] border-b border-transparent hover:border-indigo-600">{p.title}</span>
                      </button>
                    )
                  }
                  return null;
                })()}

                <div className="flex items-start gap-4">
                  <textarea
                    placeholder="Название задачи"
                    className="flex-1 text-2xl font-bold placeholder:text-slate-300 border-none focus:ring-0 p-0 text-black outline-none bg-transparent leading-tight resize-none overflow-hidden"
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

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      ref={datePickerBtnRef}
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className={`flex items-center gap-2 px-3 h-8 rounded-lg border transition ${dueDate ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                    >
                      <span className="text-sm">🗓️</span>
                      <span className="text-[11px] font-bold">
                        {dueDate ? (
                          <>
                            {format(new Date(dueDate), 'd MMM', { locale: ru })}
                            {dueTime && <span className="ml-1 opacity-70">в {dueTime}</span>}
                            {dueTime && dueTimeEnd && <span className="opacity-70"> - {dueTimeEnd}</span>}
                          </>
                        ) : "Срок"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {showDatePicker && (
                <div ref={datePickerRef} className="absolute top-14 right-6 z-50 animate-in fade-in zoom-in-95 duration-200 shadow-2xl rounded-xl border border-slate-100">
                  <DatePicker
                    dueDate={dueDate}
                    setDueDate={setDueDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    dueTime={dueTime}
                    setDueTime={setDueTime}
                    dueTimeEnd={dueTimeEnd}
                    setDueTimeEnd={setDueTimeEnd}
                    duration={duration}
                    setDuration={setDuration}
                    onClose={() => setShowDatePicker(false)}
                    onSave={autoSave}
                  />
                </div>
              )}

              {/* SCROLLABLE BODY */}
              <div className="flex-1 overflow-y-auto p-6 no-scrollbar">

                {aiSuggestion && (
                  <div className="mb-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-indigo-900 text-sm animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold flex items-center gap-2 text-indigo-600">✨ AI Совет</span>
                      <button onClick={() => setAiSuggestion(null)} className="text-indigo-400 hover:text-indigo-700 w-5 h-5 flex items-center justify-center rounded-full hover:bg-indigo-100 transition">✕</button>
                    </div>
                    <div className="leading-relaxed prose prose-sm max-w-none text-indigo-800">
                      {aiSuggestion}
                    </div>
                  </div>
                )}

                <textarea
                  placeholder="Детали..."
                  className="w-full text-[15px] text-slate-500 placeholder:text-slate-200 border-none focus:ring-0 p-0 resize-none h-40 outline-none mb-8 leading-relaxed bg-transparent"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />

                {/* SUBTASKS SECTION */}
                <div className="mb-8 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Подзадачи</span>
                  </div>
                  <div className="space-y-1">
                    {tasks.filter(t => t.parent_id === currentTaskId).sort((a, b) => a.id - b.id).map(subtask => (
                      <div key={subtask.id} className="flex items-center gap-2 group" onContextMenu={(e) => handleContextMenu(e, subtask)}>
                        <input
                          type="checkbox"
                          checked={subtask.is_completed}
                          onChange={() => toggleTask(subtask.id, subtask.is_completed)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm"
                          value={subtask.title}
                          onChange={(e) => handleTaskTitleBlur(subtask, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                          placeholder="Подзадача..."
                        />
                        <button onClick={() => deleteTask(subtask.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition px-2">×</button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={createSubtask}
                    className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 transition mt-3 group"
                  >
                    <span className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-xs group-hover:border-indigo-600 group-hover:bg-indigo-50">+</span>
                    Добавить подзадачу
                  </button>
                </div>

              </div>

              {/* FIXED FOOTER: Projects & Tags */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0 z-20">
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-2">
                    {/* PROJECT SELECTOR */}
                    <div className="relative">
                      <button
                        ref={projectSelectBtnRef}
                        onClick={() => { setShowProjectSelect(!showProjectSelect); setShowTagSelect(false); }}
                        className={`px-4 py-3 rounded-xl border text-[11px] font-bold transition flex items-center gap-2 ${listId ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                        <span>📁</span>
                        {listId ? allLists.find(l => l.id === listId)?.name : 'Проект'}
                        <span className="opacity-50 text-[10px] ml-1">▼</span>
                      </button>

                      {showProjectSelect && (
                        <div
                          ref={projectSelectRef}
                          className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-50 max-h-60 overflow-y-auto transform origin-bottom animate-in zoom-in-95 duration-200">
                          <button onClick={() => { setListId(null); setShowProjectSelect(false); }} className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2 text-slate-600">
                            <span>📥</span> Входящие
                          </button>
                          {allLists.map(list => (
                            <button key={list.id} onClick={() => { setListId(list.id); setShowProjectSelect(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2 ${listId === list.id ? 'bg-slate-100 text-black' : 'text-slate-600'}`}>
                              <span>{list.name.toUpperCase().includes('ЦЕЛИ') ? '⭐' : list.name.toUpperCase().includes('КУПИТЬ') ? '🛒' : '📁'}</span>
                              {list.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* TAG SELECTOR */}
                    <div className="relative">
                      <button
                        ref={tagSelectBtnRef}
                        onClick={() => { setShowTagSelect(!showTagSelect); setShowProjectSelect(false); }}
                        className={`px-4 py-3 rounded-xl border text-[11px] font-bold transition flex items-center gap-2 ${selectedTags && selectedTags.length > 0 ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                        <span>🏷️</span>
                        {selectedTags && selectedTags.length > 0 ? `${selectedTags.length} меток` : 'Метки'}
                        <span className="opacity-50 text-[10px] ml-1">▼</span>
                      </button>

                      {showTagSelect && (
                        <div ref={tagSelectRef} className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-50 max-h-60 overflow-y-auto transform origin-bottom animate-in zoom-in-95 duration-200">
                          {allTags.map(tag => (
                            <button key={tag.id}
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

                    {/* PRIORITY BUTTON */}
                    <button
                      onClick={() => setPriority(priority === 'low' ? 'high' : 'low')}
                      className={`px-4 py-3 rounded-xl border text-[11px] font-bold transition flex items-center gap-2 ${priority === 'high' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                      title="Приоритет"
                    >
                      <span>{priority === 'high' ? '🚩' : '🏁'}</span>
                      <span>Флаг</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {isSaving && <span className="text-[9px] text-indigo-400 animate-pulse font-bold uppercase tracking-widest mr-2">Сохранение...</span>}
                    <button
                      onClick={handleAiSuggest}
                      disabled={isAiLoading}
                      className={`flex items-center justify-center w-8 h-8 transition rounded-full ${isAiLoading ? 'cursor-not-allowed opacity-50' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                      title="AI Совет"
                    >
                      {isAiLoading ? <span className="animate-spin">⏳</span> : <span className="text-base">✨</span>}
                    </button>
                    <div className="w-[1px] h-4 bg-slate-200 mx-2"></div>
                    <button
                      onClick={() => deleteTask(currentTaskId)}
                      className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-red-500 transition rounded-full hover:bg-red-50"
                      title="Удалить задачу"
                    >
                      <span className="text-sm">🗑️</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>


          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 p-8 text-center opacity-50 select-none">
            <span className="text-4xl mb-4 grayscale">📝</span>
            <p className="text-[10px] font-bold uppercase tracking-widest">Выберите задачу</p>
          </div>
        )}
      </aside>

      {/* CALENDAR PANEL */}
      {
        isCalendarPanelOpen && (
          <aside
            style={{ width: `${calendarWidth}px` }}
            className={`${activeView === 'calendar' ? 'hidden' : 'hidden lg:flex'} flex-col flex-shrink-0 border-l border-slate-100 bg-[#FAFAFA] sticky top-0 h-screen overflow-hidden group/calendar z-10`}
          >
            <div
              onMouseDown={() => {
                isResizingCalendar.current = true
                document.body.style.cursor = 'ew-resize'
                document.body.style.userSelect = 'none'
                document.body.classList.add('resizing')
              }}
              className="absolute top-0 left-[-4px] w-2 h-full cursor-ew-resize hover:bg-indigo-500/50 transition-colors z-50 group-hover/calendar:bg-slate-200"
            />
            {/* Mini Calendar Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-2">
                <span className="text-base">📅</span>
                <h2 className="text-[13px] font-bold text-slate-800 capitalize">
                  {format(currentCalendarDate, 'MMMM yyyy', { locale: ru })}
                </h2>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                <button onClick={() => setCurrentCalendarDate(subDays(currentCalendarDate, 1))} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white text-slate-500 text-[10px]">◀</button>
                <button onClick={() => setCurrentCalendarDate(new Date())} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white text-slate-500 text-[10px]">●</button>
                <button onClick={() => setCurrentCalendarDate(addDays(currentCalendarDate, 1))} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white text-slate-500 text-[10px]">▶</button>
              </div>
              <button onClick={() => setIsCalendarPanelOpen(false)} className="text-slate-300 hover:text-black p-1 transition ml-2">✕</button>
            </div>

            <div className="flex-1 overflow-hidden relative">
              <CalendarView
                tasks={tasks}
                currentDate={currentCalendarDate}
                setCurrentDate={setCurrentCalendarDate}
                selectedTaskId={currentTaskId}
                onTaskClick={(task) => openTaskDetail(task, 'panel')}
                onDropTaskOnCalendar={onDropTaskOnCalendar}
                hourHeight={hourHeight}
                setHourHeight={setHourHeight}
                isNightHidden={isNightHidden}
                setIsNightHidden={setIsNightHidden}
                calendarDays={1}
                movingTaskState={movingTaskState}
                handleCalendarTaskTouchStart={handleCalendarTaskTouchStart}
                handleCalendarTaskTouchMove={handleCalendarTaskTouchMove}
                handleCalendarTaskTouchEnd={handleCalendarTaskTouchEnd}
                resizingTaskState={resizingTaskState}
                handleTaskResizeStart={handleTaskResizeStart}
              />
            </div>

          </aside>
        )
      }

      {/* Floating Action Button (Mobile) */}
      <button onClick={() => {
        setModalMode('create'); setTitle(''); setDescription(''); setPriority('low'); setDueDate(''); setListId(selectedListId); setSelectedTags([]); setIsModalOpen(true);
      }} className="fixed bottom-8 right-8 w-14 h-14 bg-black text-white rounded-full shadow-lg md:hidden flex items-center justify-center text-3xl font-light active:scale-95 transition z-40">
        <span className="mb-1">+</span>
      </button>

      {/* POPUP: ADD FOLDER / LIST */}
      {
        isAddPopupOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm p-6" onClick={() => setIsAddPopupOpen(false)}>
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">Создать</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => setAddMode('folder')} className={`py-2 rounded-lg text-xs font-bold transition ${addMode === 'folder' ? 'bg-black text-white' : 'bg-slate-100 text-slate-500'}`}>Папка</button>
                <button onClick={() => setAddMode('list')} className={`py-2 rounded-lg text-xs font-bold transition ${addMode === 'list' ? 'bg-black text-white' : 'bg-slate-100 text-slate-500'}`}>Проект</button>
              </div>
              <input autoFocus type="text" className="w-full text-base bg-slate-50 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-slate-100 mb-4" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddConfirm()} placeholder="Название..." />
              {addMode === 'list' && (
                <select className="w-full text-sm bg-slate-50 rounded-lg px-4 py-3 outline-none mb-4 appearance-none" value={targetFolderId} onChange={e => setTargetFolderId(e.target.value)}>
                  <option value="">Без папки</option>
                  {allFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
              <button onClick={handleAddConfirm} className="w-full bg-black text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition">Готово</button>
            </div>
          </div>
        )
      }

      {/* MODAL: TASK DETAIL */}
      {
        isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm sm:p-6" onClick={() => closeModal()}>
            <div className="bg-[#FDFDFD] w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-out"
              style={{ transform: `translateY(${dragOffset}px)`, opacity: isDragging ? 0.95 : 1, overscrollBehavior: 'contain' }}
              onClick={e => {
                e.stopPropagation();
                // Close DatePicker if clicking outside of it (and outside the toggle button)
                // This works because datePickerRef is attached to a div, not the functional component
                if (showDatePicker &&
                  datePickerRef.current && !datePickerRef.current.contains(e.target) &&
                  (!datePickerBtnRef.current || !datePickerBtnRef.current.contains(e.target))) {
                  setShowDatePicker(false);
                }
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 sm:hidden"></div>

              <div className="flex items-center justify-between p-6 sm:px-10 border-b border-slate-100">
                <button onClick={() => closeModal()} className="text-slate-400 hover:text-black transition flex items-center gap-1 text-sm">
                  <span className="text-lg">←</span> Назад
                </button>
                <div className="relative flex items-center gap-3">
                  {isSaving && <span className="text-[10px] text-indigo-400 animate-pulse">Сохранение...</span>}
                  <button onClick={() => saveTask()} className="bg-black text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-800 transition">Готово</button>
                </div>
              </div>

              <div className="flex-1 p-8 sm:p-12 overflow-y-auto no-scrollbar modal-scroll-area">
                <input
                  type="text"
                  placeholder="Что нужно сделать?"
                  className="w-full text-3xl font-bold placeholder:text-slate-100 border-none focus:ring-0 p-0 mb-6 text-black outline-none bg-transparent"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoFocus={modalMode === 'create'}
                />

                <textarea
                  placeholder="Детали задачи..."
                  className="w-full text-[15px] text-slate-500 placeholder:text-slate-200 border-none focus:ring-0 p-0 resize-none h-40 outline-none mb-8 leading-relaxed bg-transparent"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />

                {/* SUBTASKS SECTION */}
                <div className="mb-8">
                  <div className="space-y-3">
                    {Array.isArray(subtasks) && subtasks.map(st => (
                      <div key={st.id} className="flex items-start gap-3 group">
                        <button
                          onClick={() => handleToggleSubtask(st.id)}
                          className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition ${st.is_completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 hover:border-indigo-400'}`}
                        >
                          {st.is_completed && <span className="text-xs">✓</span>}
                        </button>
                        <input
                          type="text"
                          value={st.title || ''}
                          onChange={e => handleSubtaskChange(st.id, e.target.value)}
                          placeholder="Подзадача..."
                          className={`flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 outline-none ${st.is_completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}
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

                <div className="space-y-8">
                  <div className="flex flex-col gap-6">
                    <div className="flex gap-2">
                      <button
                        ref={datePickerBtnRef}
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition ${dueDate ? 'bg-black border-black text-white' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                      >
                        🗓️ {dueDate ? new Date(dueDate).toLocaleDateString() : "Срок"}
                      </button>
                      <button
                        onClick={() => setPriority(priority === 'low' ? 'high' : 'low')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition ${priority === 'high' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                      >
                        {priority === 'high' ? '🚩 Срочно' : '🏁 Обычный'}
                      </button>
                    </div>

                    {showDatePicker && (
                      <div ref={datePickerRef} className="mt-4 animate-in fade-in zoom-in-95 duration-200 flex justify-center">
                        <DatePicker
                          dueDate={dueDate}
                          setDueDate={setDueDate}
                          endDate={endDate}
                          setEndDate={setEndDate}
                          dueTime={dueTime}
                          setDueTime={setDueTime}
                          dueTimeEnd={dueTimeEnd}
                          setDueTimeEnd={setDueTimeEnd}
                          duration={duration}
                          setDuration={setDuration}
                          onClose={() => setShowDatePicker(false)}
                          onSave={() => saveTask()}
                        />
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      {/* PROJECT SELECTOR */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowProjectSelect(!showProjectSelect); setShowTagSelect(false); }}
                          className={`px-4 py-3 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${listId ? 'bg-black border-black text-white' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                        >
                          <span>📁</span>
                          {listId ? allLists.find(l => l.id === listId)?.name : 'Проект'}
                          <span className="opacity-50 text-[10px] ml-1">▼</span>
                        </button>

                        {showProjectSelect && (
                          <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-50 max-h-60 overflow-y-auto transform origin-bottom animate-in zoom-in-95 duration-200">
                            <button
                              onClick={() => { setListId(null); setShowProjectSelect(false); }}
                              className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2 text-slate-600"
                            >
                              <span>📥</span> Входящие
                            </button>
                            {allLists.map(list => (
                              <button
                                key={list.id}
                                onClick={() => { setListId(list.id); setShowProjectSelect(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2 ${listId === list.id ? 'bg-slate-100 text-black' : 'text-slate-600'}`}
                              >
                                <span>{list.name.toUpperCase().includes('ЦЕЛИ') ? '⭐' : list.name.toUpperCase().includes('КУПИТЬ') ? '🛒' : '📁'}</span>
                                {list.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* TAG SELECTOR */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowTagSelect(!showTagSelect); setShowProjectSelect(false); }}
                          className={`px-4 py-3 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${selectedTags.length > 0 ? 'bg-black border-black text-white' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                        >
                          <span>🏷️</span>
                          {selectedTags.length > 0 ? `${selectedTags.length} меток` : 'Метки'}
                          <span className="opacity-50 text-[10px] ml-1">▼</span>
                        </button>

                        {showTagSelect && (
                          <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-50 max-h-60 overflow-y-auto transform origin-bottom animate-in zoom-in-95 duration-200">
                            {allTags.map(tag => (
                              <button
                                key={tag.id}
                                onClick={() => {
                                  const isSelected = selectedTags.some(t => t.id === tag.id)
                                  if (isSelected) setSelectedTags(selectedTags.filter(t => t.id !== tag.id))
                                  else setSelectedTags([...selectedTags, tag])
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2 mb-1 ${selectedTags.some(t => t.id === tag.id) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#cbd5e1' }}></div>
                                {tag.name}
                                {selectedTags.some(t => t.id === tag.id) && <span className="ml-auto text-[10px]">✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STICKY FOOTER */}
              <div className="p-4 sm:px-10 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                <button
                  onClick={() => deleteTask(currentTaskId)}
                  className="flex items-center gap-2 px-4 py-3 text-slate-300 hover:text-red-500 transition font-bold text-[10px] uppercase tracking-widest hover:bg-red-50 rounded-xl"
                  title="Удалить задачу"
                >
                  <span className="text-sm">🗑️</span>
                </button>

                <div className="flex items-center gap-4">
                  {isSaving && <span className="text-[10px] text-indigo-400 animate-pulse font-bold">СОХРАНЕНИЕ...</span>}
                  <button onClick={() => saveTask()} className="bg-black text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-indigo-500/20">
                    Готово
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      <style>{`
        .vertical-text {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
        }
      `}</style>
      <style jsx global>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }

      `}</style>
    </div >
  )
}

export default App
