import React, { useState } from 'react';
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
    isToday,
    addDays,
    isSameMonth,
    setHours,
    setMinutes
} from 'date-fns';
import { ru } from 'date-fns/locale';

export default function DatePicker({
    dueDate,
    setDueDate,
    endDate,
    setEndDate,
    dueTime,
    setDueTime,
    dueTimeEnd,
    setDueTimeEnd,
    duration,
    setDuration,
    onClose,
    onSave // New prop for auto-saving
}) {
    const [activeTab, setActiveTab] = useState('date'); // 'date', 'duration'
    // Ensure we parse the date correctly even if it's a string, or fallback to today
    const [viewDate, setViewDate] = useState(() => {
        try {
            return dueDate ? new Date(dueDate) : new Date();
        } catch {
            return new Date();
        }
    });

    const [showRepeatMenu, setShowRepeatMenu] = useState(false);
    const [showTimeSelect, setShowTimeSelect] = useState(false);
    const [repeatRule, setRepeatRule] = useState('Не повторять');

    // Safe calendar generation
    let calendarDays = [];
    let currentMonthName = '';

    try {
        const safeViewDate = (viewDate instanceof Date && !isNaN(viewDate)) ? viewDate : new Date();
        const monthStart = startOfMonth(safeViewDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { locale: ru });
        const endDateGrid = endOfWeek(monthEnd, { locale: ru });
        calendarDays = eachDayOfInterval({ start: startDate, end: endDateGrid });
        currentMonthName = format(safeViewDate, 'LLL yyyy', { locale: ru });
    } catch (e) {
        console.error("Calendar generation error:", e);
        calendarDays = [];
    }

    const weekDays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

    const handleDateClick = (day) => {
        try {
            const formattedDate = format(day, 'yyyy-MM-dd');
            setDueDate(formattedDate);
            // Update view date to match selected date (so we jump to that month)
            setViewDate(day);

            if (endDate && formattedDate > endDate) {
                setEndDate(formattedDate);
            }
            // Auto-save immediately
            setTimeout(() => onSave && onSave(), 0);
        } catch (e) {
            console.error("Date click error:", e);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl w-[320px] overflow-hidden border border-slate-100 font-sans text-slate-700 select-none relative">
            {/* CLOSE BUTTON (Will be removed later, kept for safety now) */}
            <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-full transition z-10"
                title="Закрыть"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            {/* TABS */}
            <div className="flex p-1 mx-2 mt-2 bg-slate-100 rounded-lg mr-8">
                <button
                    onClick={() => setActiveTab('date')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'date' ? 'bg-white shadow-sm text-black' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Дата
                </button>
                <button
                    onClick={() => setActiveTab('duration')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'duration' ? 'bg-white shadow-sm text-black' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Длительность
                </button>
            </div>

            {activeTab === 'date' && (
                <div className="p-4">
                    {/* QUICK ACTIONS */}
                    <div className="flex justify-between mb-4 px-4 bg-slate-50 rounded-xl py-2">
                        <button
                            onClick={() => { handleDateClick(new Date()); }}
                            className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-blue-600 transition tooltip-container relative group flex flex-col items-center gap-1"
                            title="Сегодня"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                            <span className="text-[9px] font-medium leading-none">Сегодня</span>
                        </button>
                        <button
                            onClick={() => { handleDateClick(addDays(new Date(), 1)); }}
                            className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-orange-500 transition group flex flex-col items-center gap-1"
                            title="Завтра"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M15 6l6 6-6 6" /></svg>
                            <span className="text-[9px] font-medium leading-none">Завтра</span>
                        </button>
                        <button
                            onClick={() => { handleDateClick(addDays(new Date(), 7)); }}
                            className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-indigo-500 transition relative group flex flex-col items-center gap-1"
                            title="Через неделю"
                        >
                            <span className="text-lg font-bold leading-none -mt-1">+7</span>
                            <span className="text-[9px] font-medium leading-none">Неделя</span>
                        </button>
                    </div>

                    {/* CALENDAR HEADER */}
                    <div className="flex items-center justify-between mb-4 px-1">
                        <span className="text-sm font-semibold capitalize">
                            {currentMonthName}
                        </span>
                        <div className="flex gap-1">
                            <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-black">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <button onClick={() => setViewDate(new Date())} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-black flex items-center justify-center" title="Текущий месяц">
                                <div className="w-1.5 h-1.5 rounded-full border border-current"></div>
                            </button>
                            <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-black">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>

                    {/* CALENDAR GRID */}
                    <div className="grid grid-cols-7 mb-4">
                        {weekDays.map(day => (
                            <div key={day} className="text-center text-[10px] text-slate-400 font-medium py-1">{day}</div>
                        ))}
                        {calendarDays.map((day, idx) => {
                            const isSelected = dueDate && isSameDay(day, new Date(dueDate));
                            const isTodayDate = isToday(day);
                            try {
                                const isCurrentMonth = isSameMonth(day, viewDate);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleDateClick(day)}
                                        className={`
                                        w-8 h-8 mx-auto flex items-center justify-center rounded-full text-xs transition-all relative
                                        ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700'}
                                        ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700' : 'hover:bg-slate-100'}
                                        ${isTodayDate && !isSelected ? 'text-blue-600 font-bold' : ''}
                                        `}
                                    >
                                        {format(day, 'd')}
                                        {isTodayDate && !isSelected && <div className="absolute bottom-1 w-1 h-1 bg-blue-600 rounded-full"></div>}
                                    </button>
                                );
                            } catch {
                                return <div key={idx} className="w-8 h-8"></div>;
                            }
                        })}
                    </div>

                    {/* LIST OPTIONS */}
                    <div className="space-y-1">
                        {/* Deadline / Time */}
                        <div className="relative">
                            <div
                                className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded-lg cursor-pointer group"
                                onClick={() => setShowTimeSelect(!showTimeSelect)}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-400 text-lg">⏱</span>
                                    <span className="text-sm">{dueTime || "Срок исполнения"}</span>
                                </div>
                                <svg className={`text-slate-300 transition-transform ${showTimeSelect ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                            {showTimeSelect && (
                                <div className="absolute bottom-full left-0 mb-1 w-full bg-white border border-slate-100 shadow-xl rounded-lg overflow-y-auto max-h-48 z-10 animate-in slide-in-from-bottom-2">
                                    {['Без времени', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map(time => (
                                        <button
                                            key={time}
                                            onClick={() => {
                                                setDueTime(time === 'Без времени' ? '' : time);
                                                // Reset End Time / Duration logic to default "1 hour" block
                                                setDueTimeEnd('');
                                                setDuration(60);
                                                setShowTimeSelect(false);
                                                setTimeout(() => onSave && onSave(), 0);
                                            }}
                                            className={`w-full text-left px-4 py-2 hover:bg-slate-50 text-sm ${dueTime === time ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'}`}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded-lg cursor-pointer group">
                            <div className="flex items-center gap-3">
                                <span className="text-slate-400 text-lg">🔔</span>
                                <span className="text-sm">Уведомление</span>
                            </div>
                        </div>
                        {/* Repeat */}
                        <div className="relative">
                            <div
                                className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded-lg cursor-pointer group"
                                onClick={() => setShowRepeatMenu(!showRepeatMenu)}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-400 text-lg">🔁</span>
                                    <span className="text-sm">{repeatRule}</span>
                                </div>
                            </div>
                            {showRepeatMenu && (
                                <div className="mx-1 mt-1 bg-white border border-slate-100 shadow-inner rounded-lg overflow-hidden text-sm animate-in slide-in-from-top-2 duration-200">
                                    {['Ежедневно', 'Еженедельно', 'Ежемесячно', 'Ежегодно', 'Каждый будний день', 'Произвольно'].map((option) => (
                                        <button
                                            key={option}
                                            onClick={() => { setRepeatRule(option); setShowRepeatMenu(false); setTimeout(() => onSave && onSave(), 0); }}
                                            className={`w-full text-left px-4 py-2 hover:bg-slate-50 transition ${repeatRule === option ? 'text-blue-600 font-semibold bg-blue-50' : 'text-slate-600'}`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'duration' && (
                <div className="p-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Настройки времени</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Время начала</label>
                            <input type="time" value={dueTime} onChange={(e) => { setDueTime(e.target.value); setTimeout(() => onSave && onSave(), 1000); }} className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Время окончания</label>
                            <input type="time" value={dueTimeEnd} onChange={(e) => { setDueTimeEnd(e.target.value); setTimeout(() => onSave && onSave(), 1000); }} className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Длительность (мин)</label>
                            <input type="number" value={duration} onChange={(e) => { setDuration(parseInt(e.target.value) || 0); setTimeout(() => onSave && onSave(), 1000); }} className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none" />
                        </div>
                        <div className="pt-4 flex gap-2">
                            <button onClick={() => setActiveTab('date')} className="flex-1 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg">Готово</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
