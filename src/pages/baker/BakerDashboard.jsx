import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardShell from '../../components/DashboardShell'
import ProductionLogTab from '../../features/ProductionLogTab'
import MyTasksTab from '../../features/MyTasksTab'
import SalesTab from '../../features/SalesTab'
import DisplayInventory from '../../components/inventory/DisplayInventory'

const PANELS = {
  productionLog: ProductionLogTab,
  tasks: MyTasksTab,
  sales: SalesTab,
  display: DisplayInventory,
}

export default function BakerDashboard() {
  const { t } = useTranslation()
  const [active, setActive] = useState('productionLog')
  const Panel = PANELS[active]

  const navGroups = [
    {
      title: t('navGroups.main'),
      items: [
        { key: 'productionLog', label: t('nav.productionLog'), icon: 'clipboard' },
        { key: 'tasks', label: t('nav.myTasks'), icon: 'bread' },
        { key: 'sales', label: t('nav.sales'), icon: 'cash' },
        { key: 'display', label: t('nav.display'), icon: 'bread' },
      ],
    },
  ]

  const titles = {
    productionLog: t('productionLog.title'),
    tasks: t('baker.title'),
    sales: t('nav.sales'),
    display: t('nav.display'),
  }

  return (
    <DashboardShell navGroups={navGroups} active={active} onNavigate={setActive} title={titles[active]}>
      <Panel />
    </DashboardShell>
  )
}
