import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'

interface NotesTabProps {
  notes: string
  onSave: (notes: string) => Promise<void>
}

export function NotesTab({ notes, onSave }: NotesTabProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(notes)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(value)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (!editing && !notes) {
    return (
      <EmptyState
        icon="📝"
        title={t('patients.notesTab.empty')}
        action={
          <Button size="sm" onClick={() => setEditing(true)}>
            {t('patients.notesTab.addNote')}
          </Button>
        }
      />
    )
  }

  return (
    <div className="p-5">
      {editing ? (
        <div className="space-y-3">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder={t('patients.notes')}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setValue(notes) }}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('patients.notes')}</p>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setValue(notes) }}>
              {t('common.edit')}
            </Button>
          </div>
          <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap leading-relaxed">{notes}</p>
        </div>
      )}
    </div>
  )
}
