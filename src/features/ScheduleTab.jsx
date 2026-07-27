import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'
import { localeTag } from '../lib/i18n'
import { translateError } from '../lib/errors'

const STATUSES = ['rejalashtirilgan', 'faol', 'tugallangan', 'bekor_qilingan']

export default function ScheduleTab() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [shifts, setShifts] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ profileId: '', date: '', startTime: '09:00', endTime: '18:00' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: shiftRows, error: shiftErr }, { data: profileRows }] = await Promise.all([
      supabase
        .from('shifts')
        .select('id, start_time, end_time, status, profile_id, profiles(full_name, role)')
        .order('start_time', { ascending: true }),
      supabase.from('profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
    ])
    if (shiftErr) setError(translateError(t, shiftErr))
    setShifts(shiftRows || [])
    setEmployees(profileRows || [])
    setLoading(false)
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('shifts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  async function createShift(e) {
    e.preventDefault()
    setError('')
    if (!form.profileId || !form.date) {
      setError(t('schedule.missingFields'))
      return
    }
    setSaving(true)
    const startTime = `${form.date}T${form.startTime}:00`
    const endTime = `${form.date}T${form.endTime}:00`
    const { error: insertError } = await supabase.from('shifts').insert({
      company_id: profile.company_id,
      profile_id: form.profileId,
      start_time: startTime,
      end_time: endTime,
    })
    if (insertError) setError(translateError(t, insertError))
    else setForm({ profileId: '', date: '', startTime: '09:00', endTime: '18:00' })
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('shifts').update({ status }).eq('id', id)
  }

  async function removeShift(id) {
    await supabase.from('shifts').delete().eq('id', id)
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={createShift} className="card p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-brown-dark">{t('schedule.newShift')}</h2>
        <select
          className="input"
          value={form.profileId}
          onChange={(e) => setForm((f) => ({ ...f, profileId: e.target.value }))}
        >
          <option value="">{t('schedule.selectEmployee')}</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
        />
        <div className="flex gap-3">
          <input
            className="input flex-1"
            type="time"
            value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
          />
          <input
            className="input flex-1"
            type="time"
            value={form.endTime}
            onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
          />
        </div>
        {error && <p className="text-sm text-bad font-semibold">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('common.saving') : t('schedule.addShift')}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {loading && <p className="text-ink-muted">{t('common.loading')}</p>}
        {!loading && shifts.length === 0 && <p className="text-ink-muted">{t('schedule.noShifts')}</p>}
        {shifts.map((shift) => (
          <div key={shift.id} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-brown-dark">
                {shift.profiles?.full_name || t('schedule.unknownEmployee')}
              </p>
              <p className="text-sm text-ink-muted">
                {new Date(shift.start_time).toLocaleString(localeTag(i18n.language))} —{' '}
                {new Date(shift.end_time).toLocaleTimeString(localeTag(i18n.language), {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="text-sm rounded-lg border border-brown/20 bg-transparent px-2 py-1 text-ink font-semibold"
                value={shift.status}
                onChange={(e) => updateStatus(shift.id, e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
              <StatusBadge status={shift.status} />
              <button
                type="button"
                onClick={() => removeShift(shift.id)}
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
