import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)

  // --- 1. ЗАГРУЗКА (READ) ---
  async function fetchTasks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('id', { ascending: false }) // Сначала новые

    if (error) console.error('Ошибка загрузки:', error)
    else setTasks(data)
    setLoading(false)
  }

  // --- 2. ДОБАВЛЕНИЕ (CREATE) ---
  async function addTask(e) {
    e.preventDefault()
    if (!newTask.trim()) return

    const { error } = await supabase
      .from('tasks')
      .insert([{ title: newTask }])

    if (error) console.error('Ошибка добавления:', error)
    else {
      setNewTask('')
      fetchTasks()
    }
  }

  // --- 3. ОБНОВЛЕНИЕ СТАТУСА (UPDATE) ---
  async function toggleTask(id, isCompleted) {
    // Сначала обновляем интерфейс (для скорости), потом базу
    setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: !isCompleted } : t))

    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !isCompleted })
      .eq('id', id)

    if (error) {
      console.error('Ошибка обновления:', error)
      fetchTasks() // Если ошибка — откатываем назад, загружая с сервера
    }
  }

  // --- 4. УДАЛЕНИЕ (DELETE) ---
  async function deleteTask(id) {
    // Сразу убираем из списка на экране
    setTasks(tasks.filter(t => t.id !== id))

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Ошибка удаления:', error)
      fetchTasks()
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 font-sans">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            ✅ Мои задачи
          </h1>

          {/* ФОРМА */}
          <form onSubmit={addTask} className="flex gap-2 mb-8">
            <input
              type="text"
              placeholder="Новая задача..."
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 font-medium transition active:scale-95"
            >
              +
            </button>
          </form>

          {/* СПИСОК */}
          {loading ? (
            <div className="text-center py-10 text-slate-400">Загрузка...</div>
          ) : (
            <ul className="space-y-3">
              {tasks.length === 0 && (
                <div className="text-center text-slate-400 py-6">
                  Задач нет. Можно отдыхать! 🎉
                </div>
              )}

              {tasks.map((task) => (
                <li
                  key={task.id}
                  className={`group flex items-center justify-between p-3 rounded-lg border transition duration-200 
                    ${task.is_completed
                      ? "bg-slate-50 border-slate-100"
                      : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm"
                    }`}
                >
                  {/* Левая часть: Чекбокс + Текст */}
                  <div
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => toggleTask(task.id, task.is_completed)}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition
                      ${task.is_completed ? "bg-indigo-500 border-indigo-500" : "border-slate-300"}`}>
                      {task.is_completed && <span className="text-white text-xs">✓</span>}
                    </div>

                    <span className={`transition ${task.is_completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                      {task.title}
                    </span>
                  </div>

                  {/* Правая часть: Кнопка удаления (появляется при наведении) */}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-2"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
