import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { archiveSupplier, restoreSupplier } from './SupplierRepository'

export default function SuppliersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const suppliers = useLiveQuery(async () => {
    let all = await db.suppliers.toArray()
    if (!showArchived) all = all.filter(s => !s.deletedAt)
    if (query) {
      const q = query.toLowerCase()
      all = all.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.contactName ?? '').toLowerCase().includes(q) ||
        (s.phone ?? '').includes(q)
      )
    }
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }, [query, showArchived])

  async function handleArchive(id: string) {
    await archiveSupplier(id)
  }
  async function handleRestore(id: string) {
    await restoreSupplier(id)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">{t('suppliers.title')}</h1>
        <button
          onClick={() => navigate('/suppliers/new')}
          className="btn-primary"
        >
          {t('suppliers.addNew')}
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          className="form-input flex-1 min-w-48"
          placeholder={t('common.search')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
          />
          {t('common.showArchived')}
        </label>
      </div>

      {!suppliers?.length ? (
        <p className="text-center text-gray-500 py-12">{t('suppliers.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('suppliers.name')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('suppliers.contact')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('suppliers.phone')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('suppliers.email')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('common.status')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {suppliers.map(s => (
                <tr
                  key={s.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${s.deletedAt ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <button
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={() => navigate(`/suppliers/${s.id}`)}
                    >
                      {s.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.contactName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    {s.deletedAt
                      ? <span className="badge-red">{t('common.archived')}</span>
                      : <span className="badge-green">{t('common.active')}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => navigate(`/suppliers/${s.id}/edit`)}
                      >
                        {t('common.edit')}
                      </button>
                      {s.deletedAt ? (
                        <button
                          className="text-xs text-green-600 hover:underline"
                          onClick={() => handleRestore(s.id)}
                        >
                          {t('common.restore')}
                        </button>
                      ) : (
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => handleArchive(s.id)}
                        >
                          {t('common.archive')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
