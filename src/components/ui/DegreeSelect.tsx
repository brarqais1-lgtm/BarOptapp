import { useMemo } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  className?: string
  hasError?: boolean
}

export function DegreeSelect({
  value,
  onChange,
  min = -20,
  max = 20,
  step = 0.25,
  placeholder = '—',
  className = '',
  hasError = false,
}: Props) {
  const options = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    for (let n = max; n >= min - 0.001; n -= step) {
      const r = Math.round(n * 100) / 100
      const val = r.toFixed(2)
      const label = r === 0 ? 'PL  0.00' : r > 0 ? `+${r.toFixed(2)}` : r.toFixed(2)
      opts.push({ value: val, label })
    }
    return opts
  }, [min, max, step])

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      dir="ltr"
      className={`w-full px-2 py-2.5 text-sm text-center rounded-xl border font-mono cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${hasError
          ? 'border-red-400 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400'
          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
        } ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
