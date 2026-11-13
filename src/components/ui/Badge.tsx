export type BadgeVariant = 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'teal' | 'purple'

const styles: Record<BadgeVariant, string> = {
  blue:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  green:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  red:    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  gray:   'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  teal:   'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
}

export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  )
}
