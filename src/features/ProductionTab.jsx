import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'
import { translateError } from '../lib/errors'

const STATUSES = ['rejalashtirilgan', 'jarayonda', 'tayyor', 'bekor_qilingan']

export default function ProductionTab() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [products, setProducts] = useState([])
  const [tasks, setTasks] = useState([])
  const [bakers, setBakers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [productForm, setProductForm] = useState({ name: '', unit: 'dona', price: '' })
  const [taskForm, setTaskForm] = useState({ productId: '', assignedTo: '', quantity: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: productRows }, { data: taskRows }, { data: profileRows }] = await Promise.all([
      supabase.from('products').select('id, name, unit, price').order('name'),
      supabase
        .from('production_tasks')
        .select('id, quantity, status, created_at, products(name, unit), assigned_to, profiles(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name').eq('role', 'baker').eq('is_active', true).order('full_name'),
    ])
    setProducts(productRows || [])
    setTasks(taskRows || [])
    setBakers(profileRows || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('production-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_tasks' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  async function createProduct(e) {
    e.preventDefault()
    setError('')
    if (!productForm.name) return
    setSaving(true)
    const { error: insertError } = await supabase.from('products').insert({
      company_id: profile.company_id,
      name: productForm.name,
      unit: productForm.unit,
      price: Number(productForm.price) || 0,
    })
    if (insertError) setError(translateError(t, insertError))
    else setProductForm({ name: '', unit: 'dona', price: '' })
    setSaving(false)
    load()
  }

  async function createTask(e) {
    e.preventDefault()
    setError('')
    if (!taskForm.productId || !taskForm.quantity) {
      setError(t('production.missingFields'))
      return
    }
    setSaving(true)
    const { error: insertError } = await supabase.from('production_tasks').insert({
      company_id: profile.company_id,
      product_id: taskForm.productId,
      assigned_to: taskForm.assignedTo || null,
      quantity: Number(taskForm.quantity),
    })
    if (insertError) setError(translateError(t, insertError))
    else setTaskForm({ productId: '', assignedTo: '', quantity: '' })
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('production_tasks').update({ status }).eq('id', id)
  }

  async function removeTask(id) {
    await supabase.from('production_tasks').delete().eq('id', id)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-4">
        <h2 className="font-semibold text-brown-dark mb-3">{t('production.products')}</h2>
        <form onSubmit={createProduct} className="flex flex-wrap gap-2 mb-3">
          <input
            className="input flex-1 min-w-[120px]"
            placeholder={t('production.namePlaceholder')}
            value={productForm.name}
            onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="input w-24"
            placeholder={t('production.unitPlaceholder')}
            value={productForm.unit}
            onChange={(e) => setProductForm((f) => ({ ...f, unit: e.target.value }))}
          />
          <input
            className="input w-28"
            type="number"
            placeholder={t('production.pricePlaceholder')}
            value={productForm.price}
            onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))}
          />
          <button type="submit" disabled={saving} className="btn-secondary px-4">
            {t('common.add')}
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {products.map((p) => (
            <span key={p.id} className="text-sm px-3 py-1.5 rounded-full bg-orange-pale text-brown font-bold">
              {t('production.productChip', { name: p.name, price: p.price, unit: p.unit })}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={createTask} className="card p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-brown-dark">{t('production.newTask')}</h2>
        <select
          className="input"
          value={taskForm.productId}
          onChange={(e) => setTaskForm((f) => ({ ...f, productId: e.target.value }))}
        >
          <option value="">{t('production.selectProduct')}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={taskForm.assignedTo}
          onChange={(e) => setTaskForm((f) => ({ ...f, assignedTo: e.target.value }))}
        >
          <option value="">{t('production.selectWorker')}</option>
          {bakers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.full_name}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="number"
          placeholder={t('production.quantityPlaceholder')}
          value={taskForm.quantity}
          onChange={(e) => setTaskForm((f) => ({ ...f, quantity: e.target.value }))}
        />
        {error && <p className="text-sm text-bad font-semibold">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('common.saving') : t('production.addTask')}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {loading && <p className="text-ink-muted">{t('common.loading')}</p>}
        {!loading && tasks.length === 0 && <p className="text-ink-muted">{t('production.noTasks')}</p>}
        {tasks.map((task) => (
          <div key={task.id} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-brown-dark">
                {task.products?.name} — {task.quantity} {task.products?.unit}
              </p>
              <p className="text-sm text-ink-muted">{task.profiles?.full_name || t('common.unassigned')}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="text-sm rounded-lg border border-brown/20 bg-transparent px-2 py-1 text-ink font-semibold"
                value={task.status}
                onChange={(e) => updateStatus(task.id, e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
              <StatusBadge status={task.status} />
              <button
                type="button"
                onClick={() => removeTask(task.id)}
                className="text-bad text-sm font-bold underline"
              >
                {t('common.remove')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
