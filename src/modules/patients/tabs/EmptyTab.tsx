import { EmptyState } from '../../../components/ui/EmptyState'

interface EmptyTabProps {
  icon?: string
  title: string
  hint?: string
}

export function EmptyTab({ icon, title, hint }: EmptyTabProps) {
  return <EmptyState icon={icon} title={title} description={hint} />
}
