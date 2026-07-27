import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardShell from '../../components/DashboardShell'
import ProductionLogTab from '../../features/ProductionLogTab'
import MyTasksTab from '../../features/MyTasksTab'
import SalesTab from '../../features/SalesTab'

const PANELS = {
  productionLog: ProductionLogTab,
  tasks: MyTasksTab,
  sales: SalesTab,
}

export default function BakerDashboard() {
  const { t } = useTranslation()
  const [active, setActive] = useState('productionLog')
  const Panel = PANELS[active]

  const navGroups = [
    {
      title: t('navGroups.main'),
      items: [
        { key: 'productionLog', label: t('nav.productionLog'), icon: '📝' },
        { key: 'tasks', label: t('nav.myTasks'), icon: '🥖' },
        { key: 'sales', label: t('nav.sales'), icon: '💰' },
      ],
    },
  ]

  const titles = {
    productionLog: t('productionLog.title'),
    tasks: t('baker.title'),
    sales: t('nav.sales'),
  }

  return (
    <DashboardShell navGroups={navGroups} active={active} onNavigate={setActive} title={titles[active]}>
      <Panel />
    </DashboardShell>
  )
}
