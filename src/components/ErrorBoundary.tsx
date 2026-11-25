import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-lg w-full bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-800 p-6 shadow-lg">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">حدث خطأ غير متوقع</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            يرجى تحديث الصفحة. إذا استمرت المشكلة، تواصل مع الدعم مع نسخ الرسالة أدناه.
          </p>
          <pre className="bg-slate-100 dark:bg-slate-900 rounded-xl p-3 text-xs text-red-600 dark:text-red-400 overflow-auto max-h-48 whitespace-pre-wrap break-all mb-4">
            {error.message}
            {error.stack ? '\n\n' + error.stack : ''}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors"
          >
            تحديث الصفحة
          </button>
        </div>
      </div>
    )
  }
}
