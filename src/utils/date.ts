/** Returns age in years from an ISO-8601 date string */
export function calcAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/** Format ISO-8601 date to locale-aware short date */
export function formatDate(iso: string, locale = 'ar-SA'): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

/** Format ISO-8601 datetime */
export function formatDateTime(iso: string, locale = 'ar-SA'): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** Returns "today" | "yesterday" | formatted date */
export function relativeDate(iso: string, locale = 'ar-SA'): string {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return locale.startsWith('ar') ? 'اليوم' : 'Today'
  if (diff === 1) return locale.startsWith('ar') ? 'أمس' : 'Yesterday'
  return formatDate(iso, locale)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
