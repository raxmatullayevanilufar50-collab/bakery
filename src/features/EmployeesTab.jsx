import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { callCreateEmployee } from '../lib/edgeFunctions'
import { translateError } from '../lib/errors'

export default function EmployeesTab() {
  const { t } = useTranslation()
  const [employees, setEmployees] = useState([])
  const [invites, setInvites] = useState([])
  const [companyCode, setCompanyCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '', role: 'baker' })

  const ROLES = [
    { value: 'manager', label: t('employees.roleManager') },
    { value: 'baker', label: t('employees.roleBaker') },
    { value: 'driver', label: t('employees.roleDriver') },
    { value: 'cashier', label: t('employees.roleCashier') },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: empRows }, { data: inviteRows }, { data: company }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, phone, is_active').order('full_name'),
      supabase
        .from('invites')
        .select('id, code, full_name, role, phone, used_at, expires_at')
        .is('used_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('companies').select('code').single(),
    ])
    setEmployees(empRows || [])
    setInvites(inviteRows || [])
    setCompanyCode(company?.code || '')
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createInvite(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.fullName.trim()) {
      setError(t('employees.missingFields'))
      return
    }
    setSaving(true)
    try {
      const { code } = await callCreateEmployee({
        fullName: form.fullName.trim(),
        role: form.role,
        phone: form.phone.trim() || null,
      })
      setSuccess(t('employees.createdWithCode', { code }))
      setForm({ fullName: '', phone: '', role: 'baker' })
    } catch (err) {
      setError(translateError(t, err))
    }
    setSaving(false)
    load()
  }

  async function changeRole(profileId, role) {
    const { error: rpcError } = await supabase.rpc('update_employee_role', {
      p_profile_id: profileId,
      p_role: role,
    })
    if (rpcError) setError(translateError(t, rpcError))
    load()
  }

  async function toggleActive(profileId, isActive) {
    const { error: rpcError } = await supabase.rpc('set_employee_active', {
      p_profile_id: profileId,
      p_is_active: !isActive,
    })
    if (rpcError) setError(translateError(t, rpcError))
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      {companyCode && (
        <div className="card p-4 flex items-center justify-between gap-3 bg-orange-pale">
          <div>
            <p className="text-xs font-bold text-ink-muted uppercase tracking-wide">{t('employees.companyCode')}</p>
            <p className="text-sm text-ink-muted mt-0.5">{t('employees.companyCodeHint')}</p>
          </div>
          <span className="font-mono font-black text-2xl tracking-widest text-brown-dark">{companyCode}</span>
        </div>
      )}

      <form onSubmit={createInvite} className="card p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-brown-dark">{t('employees.inviteTitle')}</h2>
        <input
          className="input"
          placeholder={t('employees.fullNamePlaceholder')}
          value={form.fullName}
          onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
        />
        <input
          className="input"
          placeholder={t('employees.phonePlaceholderOptional')}
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-bad font-semibold">{error}</p>}
        {success && <p className="text-sm text-good font-semibold">{success}</p>}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('employees.creating') : t('employees.createInvite')}
        </button>
      </form>

      {invites.length > 0 && (
        <div className="card p-4">
          <h2 className="font-extrabold text-brown-dark mb-3">{t('employees.pendingInvites')}</h2>
          <div className="flex flex-col gap-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between text-sm bg-orange-pale rounded-xl px-3 py-2"
              >
                <span className="text-ink font-semibold">
                  {inv.full_name} · {inv.phone}
                </span>
                <span className="font-mono font-black tracking-widest text-brown-dark">{inv.code}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {loading && <p className="text-ink-muted">{t('common.loading')}</p>}
        {employees.map((emp) => (
          <div key={emp.id} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-brown-dark">{emp.full_name}</p>
              <p className="text-sm text-ink-muted">{emp.phone}</p>
            </div>
            <div className="flex items-center gap-2">
              {emp.role === 'owner' ? (
                <span className="text-sm font-bold text-ink-muted">{t('employees.owner')}</span>
              ) : (
                <select
                  className="text-sm rounded-lg border border-brown/20 bg-transparent px-2 py-1 text-ink font-semibold"
                  value={emp.role}
                  onChange={(e) => changeRole(emp.id, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}
              {emp.role !== 'owner' && (
                <button
                  type="button"
                  onClick={() => toggleActive(emp.id, emp.is_active)}
                  className={`text-sm font-bold underline ${emp.is_active ? 'text-bad' : 'text-good'}`}
                >
                  {emp.is_active ? t('employees.deactivate') : t('employees.activate')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
