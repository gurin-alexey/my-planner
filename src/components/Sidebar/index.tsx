import React, { useState } from 'react'
import { useTaskStore } from '../../store/useTaskStore'

const SidebarContent: React.FC = () => {
    // Store State
    const allFolders = useTaskStore(state => state.allFolders)
    const allLists = useTaskStore(state => state.allLists)
    const allTags = useTaskStore(state => state.allTags)
    const tasks = useTaskStore(state => state.tasks)

    // Filters
    const selectedListId = useTaskStore(state => state.selectedListId)
    const selectedTagId = useTaskStore(state => state.selectedTagId)
    const dateFilter = useTaskStore(state => state.dateFilter)
    const activeView = useTaskStore(state => state.activeView)

    // Actions
    const setSelectedListId = useTaskStore(state => state.setSelectedListId)
    const setSelectedTagId = useTaskStore(state => state.setSelectedTagId)
    const setDateFilter = useTaskStore(state => state.setDateFilter)
    const setActiveView = useTaskStore(state => state.setActiveView)
    const setIsSidebarOpen = useTaskStore(state => state.setIsSidebarOpen)
    const setIsSettingsOpen = useTaskStore(state => state.setIsSettingsOpen)

    // UI Actions
    const collapsedFolders = useTaskStore(state => state.collapsedFolders)
    const toggleFolder = useTaskStore(state => state.toggleFolder)

    // CRUD Actions
    const createTag = useTaskStore(state => state.createTag)
    const deleteTag = useTaskStore(state => state.deleteTag)
    const deleteList = useTaskStore(state => state.deleteList)
    const deleteFolder = useTaskStore(state => state.deleteFolder)
    const createList = useTaskStore(state => state.createList)
    const onDropTask = useTaskStore(state => state.onDropTask)
    const onDrop = useTaskStore(state => state.onDrop) // List on Folder
    const onDropFolderSorting = useTaskStore(state => state.onDropFolderSorting)
    const onDropListSorting = useTaskStore(state => state.onDropListSorting)

    const resetFilters = () => {
        setSelectedListId(null)
        setSelectedTagId(null)
        setDateFilter('all') // or null if store allows
    }

    // Local UI State
    const [hoveredListId, setHoveredListId] = useState<string | null>(null)
    type DragInfo = { id: string, position: 'top' | 'bottom' }
    const [dragOverListInfo, setDragOverListInfo] = useState<DragInfo | null>(null)
    const [dragOverFolderInfo, setDragOverFolderInfo] = useState<DragInfo | null>(null)
    const [isCreatingList, setIsCreatingList] = useState(false)
    const [newListName, setNewListName] = useState('')

    const handleCreateList = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newListName.trim()) {
            await createList(newListName)
            setNewListName('')
            setIsCreatingList(false)
        }
    }

    // Handlers
    const onDragStartFolder = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('folderId', id)
    }
    const onDragStartList = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('listIdForSort', id)
        e.dataTransfer.setData('listId', id) // Also set listId for folder drop
    }

    const navigationItems = [
        {
            id: 'calendar',
            label: 'Календарь',
            icon: '📅',
            count: 0,
            action: () => setActiveView('calendar'),
            active: activeView === 'calendar'
        },
        {
            id: 'inbox',
            label: 'Входящие',
            icon: '📥',
            count: tasks.filter(t => !t.list_id && t.status !== 'done').length,
            action: () => { resetFilters(); setActiveView('tasks'); },
            active: activeView === 'tasks' && !selectedTagId && !selectedListId && (!dateFilter || dateFilter === 'all')
        },
        {
            id: 'today',
            label: 'Сегодня',
            icon: '🗓️',
            count: tasks.filter(t => t.due_date?.split('T')[0] === new Date().toISOString().split('T')[0] && t.status !== 'done').length,
            action: () => setDateFilter('today'),
            active: activeView === 'tasks' && dateFilter === 'today'
        },
        {
            id: 'tomorrow',
            label: 'Завтра',
            icon: '🌅',
            // Mock logic for tomorrow check as per previous code, ideally use date-fns isTomorrow
            count: tasks.filter(t => {
                if (!t.due_date) return false
                const d = new Date(t.due_date); const now = new Date(); now.setDate(now.getDate() + 1);
                return d.toISOString().split('T')[0] === now.toISOString().split('T')[0] && t.status !== 'done'
            }).length,
            action: () => { /* setDateFilter('tomorrow') - assuming store supports it or custom logic */ },
            active: false // activeView === 'tasks' && dateFilter === 'tomorrow'
        },
    ]

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
                    {navigationItems.map(item => (
                        <button key={item.id} onClick={() => { item.action(); setSelectedListId(null); setSelectedTagId(null); setIsSidebarOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition ${item.active ? 'bg-[#E5E5E5] text-black shadow-none' : 'text-[#666] hover:bg-[#F1F1F1]'}`}>
                            <div className="flex items-center gap-3"><span className="text-base opacity-70 grayscale">{item.icon}</span> {item.label}</div>
                            <span className="text-[11px] text-slate-400 font-normal">{item.count > 0 ? item.count : ''}</span>
                        </button>
                    ))}
                </div>

                {/* ПРОЕКТЫ (Header) */}
                <div
                    className="px-6 mb-2 flex items-center justify-between group"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                        const listId = e.dataTransfer.getData('listId');
                        if (listId) {
                            onDrop(e, ''); // Empty string for root? Or null? Store expects folderId string
                        }
                    }}
                >
                    <div className="flex items-center gap-2 cursor-pointer w-full" onClick={() => toggleFolder('lists_section')}>
                        <span className={`text-[9px] text-slate-400 transition transform ${collapsedFolders['lists_section'] ? '-rotate-90' : ''}`}>▼</span>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Списки</p>
                    </div>
                    <button className="text-slate-300 hover:text-black transition opacity-0 group-hover:opacity-100 text-lg leading-none mb-1 cursor-pointer z-10">+</button>
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
                                onDragLeave={() => {
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
                                        {tasks.filter(t => allLists.some(l => l.folder_id === folder.id && l.id === t.list_id) && t.status !== 'done').length || ''}
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
                                                onClick={() => { setSelectedListId(list.id); setSelectedTagId(null); setDateFilter('all'); setIsSidebarOpen(false); setActiveView('tasks'); }}
                                                className={`relative group w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${selectedListId === list.id ? 'bg-[#E5E5E5] text-black shadow-sm' : hoveredListId === list.id ? 'bg-indigo-600 text-white scale-[1.02] shadow-lg z-10' : 'text-[#666] hover:bg-[#F1F1F1]'} ${dragOverListInfo?.id === list.id && dragOverListInfo?.position === 'top' ? 'mt-1' : ''} ${dragOverListInfo?.id === list.id && dragOverListInfo?.position === 'bottom' ? 'mb-1' : ''}`}
                                            >
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
                                                    {tasks.filter(t => t.list_id === list.id && t.status !== 'done').length || ''}
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
                                    else if (draggedListIdForFolder) onDrop(e, ''); // Default folder root?
                                    else onDropTask(e, list.id);
                                }}
                                onClick={() => { setSelectedListId(list.id); setSelectedTagId(null); setDateFilter('all'); setIsSidebarOpen(false); setActiveView('tasks'); }}
                                className={`relative group w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${selectedListId === list.id ? 'bg-[#E5E5E5] text-black shadow-sm' : hoveredListId === list.id ? 'bg-indigo-600 text-white scale-[1.02] shadow-lg z-10' : 'text-[#666] hover:bg-[#F1F1F1]'} ${dragOverListInfo?.id === list.id && dragOverListInfo?.position === 'top' ? 'mt-1' : ''} ${dragOverListInfo?.id === list.id && dragOverListInfo?.position === 'bottom' ? 'mb-1' : ''}`}
                            >
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
                                    {tasks.filter(t => t.list_id === list.id && t.status !== 'done').length || ''}
                                </span>
                                <button onClick={(e) => deleteList(e, list.id)} className={`hidden group-hover:block transition-colors ${hoveredListId === list.id ? 'text-white' : 'text-slate-300 hover:text-red-500'} text-[10px]`}>✕</button>
                            </button>
                        ))}
                    </div>
                )}

                {/* CREATE LIST BUTTON/INPUT */}
                {isCreatingList ? (
                    <form onSubmit={handleCreateList} className="px-5 mt-1 mb-4">
                        <input
                            autoFocus
                            type="text"
                            value={newListName}
                            onChange={e => setNewListName(e.target.value)}
                            placeholder="Название списка..."
                            className="w-full text-[13px] bg-white border border-indigo-200 rounded-lg px-3 py-2 outline-none text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-100 transition"
                            onBlur={() => { if (!newListName) setIsCreatingList(false) }}
                        />
                    </form>
                ) : (
                    <button
                        onClick={() => setIsCreatingList(true)}
                        className="mx-5 mb-4 flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-dashed border-slate-200 hover:border-indigo-200 rounded-xl transition-all"
                    >
                        <span>+</span>
                        <span>Новый список</span>
                    </button>
                )}

                {/* TAGS (Header + Collapsible) */}
                <div className="px-6 mb-2 flex items-center justify-between group">
                    <div className="flex items-center gap-2 cursor-pointer w-full" onClick={() => toggleFolder('tags_section')}>
                        <span className={`text-[9px] text-slate-400 transition transform ${collapsedFolders['tags_section'] ? '-rotate-90' : ''}`}>▼</span>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Метки</p>
                    </div>
                    <button onClick={() => { const name = prompt('Новая метка:'); if (name) { createTag(name); } }} className="text-slate-300 hover:text-black transition opacity-0 group-hover:opacity-100 text-lg leading-none mb-1 cursor-pointer z-10">+</button>
                </div>

                {!collapsedFolders['tags_section'] && (
                    <div className="px-3 mb-6">
                        {allTags.map(tag => (
                            <button key={tag.id}
                                onClick={() => { setSelectedTagId(tag.id); setSelectedListId(null); setDateFilter('all'); setIsSidebarOpen(false); setActiveView('tasks'); }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] font-medium transition group ${selectedTagId === tag.id ? 'bg-indigo-50 text-indigo-700' : 'text-[#666] hover:bg-[#F1F1F1]'}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#cbd5e1' }}></div>
                                    <span className="truncate">{tag.name}</span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-normal">{tasks.filter(t => t.tags && t.tags.some(tt => tt.id === tag.id) && t.status !== 'done').length || ''}</span>
                                <button onClick={(e) => deleteTag(e, tag.id)} className={`hidden group-hover:block transition-colors text-slate-300 hover:text-red-500 text-[10px] ml-2`}>✕</button>
                            </button>
                        ))}
                    </div>
                )}

            </div>

            {/* Settings Button */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition text-[13px] font-medium group"
                >
                    <span className="text-base grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100">⚙️</span>
                    Настройки
                </button>
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
        </div >
    )
}

export default SidebarContent
