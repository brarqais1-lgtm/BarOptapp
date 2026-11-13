import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../database/db'

const CURRENCY_SYMBOLS: Record<string, string> = {
  SAR: 'ر.س', USD: '$', EUR: '€', AED: 'د.إ',
  KWD: 'د.ك', QAR: 'ر.ق', BHD: 'د.ب', JOD: 'د.أ', EGP: 'ج.م',
  IQD: 'د.ع',
}

export function useCurrency() {
  const code = useLiveQuery(async () => {
    const row = await db.settings.filter(s => s.key === 'currency' && !s.deletedAt).first()
    return row?.value ?? 'IQD'
  }, [], 'IQD') ?? 'IQD'

  return {
    code,
    symbol: CURRENCY_SYMBOLS[code] ?? code,
    format: (n: number) =>
      `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOLS[code] ?? code}`,
  }
}
