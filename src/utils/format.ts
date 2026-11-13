/** Format a number as currency */
export function formatCurrency(amount: number, currency = 'IQD', locale = 'ar-IQ'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

/** Format a number with locale-aware separators */
export function formatNumber(n: number, locale = 'ar-SA'): string {
  return new Intl.NumberFormat(locale).format(n)
}

/** Normalize a string for search (lowercase + trim) */
export function normalizeSearch(s: string): string {
  return s.trim().toLowerCase()
}

/** Normalize phone number — keep only digits */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}
