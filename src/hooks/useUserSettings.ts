import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store/useAuthStore'

export function useUserSettings() {
    const session = useAuthStore((state) => state.session)
    const [isNightHidden, setIsNightHidden] = useState<boolean>(() => localStorage.getItem('isNightHidden') === 'true')
    const [workingStart, setWorkingStart] = useState<number>(() => {
        const saved = localStorage.getItem('workingStart');
        return saved ? Number(saved) : 9;
    })
    const [workingEnd, setWorkingEnd] = useState<number>(() => {
        const saved = localStorage.getItem('workingEnd');
        return saved ? Number(saved) : 18;
    })
    const [hourHeight, setHourHeight] = useState<number>(() => {
        const saved = localStorage.getItem('hourHeight');
        return saved ? Number(saved) : 60;
    })

    // Load from DB when session changes
    useEffect(() => {
        if (session?.user?.id) {
            const loadSettings = async () => {
                const { data } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .single()

                if (data) {
                    setWorkingStart(data.working_start)
                    setWorkingEnd(data.working_end)
                    setIsNightHidden(data.is_night_hidden)
                }
            }
            loadSettings()
        }
    }, [session])

    // Persist to LocalStorage and DB
    useEffect(() => {
        localStorage.setItem('isNightHidden', String(isNightHidden))
        localStorage.setItem('workingStart', String(workingStart))
        localStorage.setItem('workingEnd', String(workingEnd))
        localStorage.setItem('hourHeight', String(hourHeight))

        if (session?.user?.id) {
            const timer = setTimeout(() => {
                supabase.from('user_settings').upsert({
                    user_id: session.user.id,
                    working_start: workingStart,
                    working_end: workingEnd,
                    is_night_hidden: isNightHidden,
                    // hour_height: hourHeight, // add to DB if column exists, otherwise just local for now or ignore DB sync for zoom
                    updated_at: new Date()
                })
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [isNightHidden, workingStart, workingEnd, hourHeight, session])

    return {
        isNightHidden, setIsNightHidden,
        workingStart, setWorkingStart,
        workingEnd, setWorkingEnd,
        hourHeight, setHourHeight
    }
}
