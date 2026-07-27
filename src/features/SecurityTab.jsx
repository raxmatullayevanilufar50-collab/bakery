import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { localeTag } from '../lib/i18n'

export default function SecurityTab() {
  const { t, i18n } = useTranslation()
  const [devices, setDevices] = useState([])
  const [logs, setLogs] = useState([])
  const [profileNames, setProfileNames] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: deviceRows }, { data: logRows }, { data: profileRows }] = await Promise.all([
      supabase
        .from('devices')
        .select('id, device_label, last_seen_at, is_revoked, profiles(full_name)')
        .order('last_seen_at', { ascending: false }),
      supabase
        .from('audit_logs')
        .select('id, actor_id, action, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('profiles').select('id, full_name'),
    ])
    setDevices(deviceRows || [])
    setLogs(logRows || [])
    setProfileNames(Object.fromEntries((profileRows || []).map((p) => [p.id, p.full_name])))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function revoke(deviceId) {
    await supabase.rpc('revoke_device', { p_device_id: deviceId })
    load()
  }

  if (loading) return <p className="text-ink-muted font-semibold">{t('common.loading')}</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-4">
        <h2 className="font-extrabold text-brown-dark mb-3">{t('security.connectedDevices')}</h2>
        <div className="flex flex-col gap-2">
          {devices.length === 0 && <p className="text-sm text-ink-muted font-semibold">{t('security.noDevices')}</p>}
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="text-ink font-semibold">
                  {d.profiles?.full_name} · {d.device_label}
                </p>
                <p className="text-ink-muted">
                  {t('security.lastSeen', { time: new Date(d.last_seen_at).toLocaleString(localeTag(i18n.language)) })}
                </p>
              </div>
              {d.is_revoked ? (
                <span className="text-bad font-bold">{t('security.blocked')}</span>
              ) : (
                <button type="button" onClick={() => revoke(d.id)} className="text-bad font-bold underline">
                  {t('security.block')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-extrabold text-brown-dark mb-3">{t('security.auditLog')}</h2>
        <div className="flex flex-col gap-2">
          {logs.length === 0 && <p className="text-sm text-ink-muted font-semibold">{t('security.noLogs')}</p>}
          {logs.map((log) => (
            <div key={log.id} className="text-sm flex justify-between">
              <span className="text-ink font-semibold">
                {profileNames[log.actor_id] || t('common.unknown')} —{' '}
                {t(`security.action_${log.action}`, log.action)}
              </span>
              <span className="text-ink-muted">{new Date(log.created_at).toLocaleString(localeTag(i18n.language))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
