import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import StatusBadge from '../components/StatusBadge'
import VoiceButton from '../components/VoiceButton'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Baker'ga tayinlangan ishlab chiqarish vazifalari (Manager/Owner tomonidan
// oldindan yaratilgan) — "Ishlab chiqarish qaydi" (erkin qayd)dan farqli.
export default function MyTasksTab() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [quantityDrafts, setQuantityDrafts] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('production_tasks')
      .select('id, quantity, status, created_at, products(name, unit)')
      .eq('assigned_to', profile.id)
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('baker-tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'production_tasks', filter: `assigned_to=eq.${profile.id}` },
        load
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load, profile.id])

  async function setStatus(taskId, status) {
    await supabase.rpc('update_task_status', { p_task_id: taskId, p_status: status })
  }

  async function saveQuantity(taskId) {
    const value = Number(quantityDrafts[taskId])
    if (!value || value <= 0) return
    await supabase.rpc('update_task_quantity', { p_task_id: taskId, p_quantity: value })
    setQuantityDrafts((d) => ({ ...d, [taskId]: '' }))
  }

  function onVoiceResult(taskId, transcript) {
    const digits = transcript.replace(/\D/g, '')
    if (digits) {
      setQuantityDrafts((d) => ({ ...d, [taskId]: digits }))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {loading && <p className="text-ink-muted font-semibold">{t('common.loading')}</p>}
      {!loading && tasks.length === 0 && <p className="text-ink-muted font-semibold">{t('baker.noTasks')}</p>}
      {tasks.map((task) => (
        <div key={task.id} className="card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-extrabold text-lg text-brown-dark">{task.products?.name}</p>
            <StatusBadge status={task.status} />
          </div>
          <p className="text-ink-muted font-semibold">
            {t('baker.plan', { qty: task.quantity, unit: task.products?.unit })}
          </p>

          <div className="flex items-center gap-2">
            <input
              className="input flex-1"
              type="number"
              placeholder={t('baker.actualQuantity')}
              value={quantityDrafts[task.id] ?? ''}
              onChange={(e) => setQuantityDrafts((d) => ({ ...d, [task.id]: e.target.value }))}
            />
            <VoiceButton onResult={(text) => onVoiceResult(task.id, text)} />
            <button type="button" onClick={() => saveQuantity(task.id)} className="btn-secondary px-4 h-12">
              {t('common.save')}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={task.status === 'jarayonda' || task.status === 'tayyor'}
              onClick={() => setStatus(task.id, 'jarayonda')}
              className="btn-secondary flex-1 h-12"
            >
              {t('baker.started')}
            </button>
            <button
              type="button"
              disabled={task.status === 'tayyor'}
              onClick={() => setStatus(task.id, 'tayyor')}
              className="btn-primary flex-1 h-12"
            >
              {t('baker.finished')}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
