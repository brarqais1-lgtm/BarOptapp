import type { Patient, EyeExamination, Prescription } from '../../database/schema'
import i18n from 'i18next'

interface Props {
  patient: Patient
  examination: EyeExamination
  prescription: Prescription
}

function fmtNum(n: number | undefined): string {
  if (n === undefined) return '—'
  return n >= 0 ? `+${n}` : String(n)
}

function row(label: string, od: string, os: string) {
  return { label, od, os }
}

export function PrescriptionPrintView({ patient, examination, prescription: rx }: Props) {
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-SA' : 'en-US'

  const fmtDate = (iso: string | undefined) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return iso.slice(0, 10)
    }
  }

  const rows = [
    row('SPH',  fmtNum(rx.reSphere),   fmtNum(rx.leSphere)),
    row('CYL',  fmtNum(rx.reCylinder), fmtNum(rx.leCylinder)),
    row('AXIS', rx.reAxis !== undefined ? String(rx.reAxis) : '—', rx.leAxis !== undefined ? String(rx.leAxis) : '—'),
    row('ADD',  fmtNum(rx.reAdd),      fmtNum(rx.leAdd)),
    ...(rx.rePrismPower !== undefined || rx.lePrismPower !== undefined
      ? [row('PRISM', rx.rePrismPower !== undefined ? `${rx.rePrismPower}Δ${rx.rePrismBase ? ` ${rx.rePrismBase}` : ''}` : '—',
                       rx.lePrismPower !== undefined ? `${rx.lePrismPower}Δ${rx.lePrismBase ? ` ${rx.lePrismBase}` : ''}` : '—')]
      : []),
    ...(rx.reVA || rx.leVA ? [row('VA', rx.reVA ?? '—', rx.leVA ?? '—')] : []),
  ]

  const hasPd = rx.pdDistance !== undefined || rx.pdNear !== undefined || rx.rePd !== undefined || rx.lePd !== undefined

  return (
    <div className="hidden print:block" dir={isAr ? 'rtl' : 'ltr'}>
      <div style={{ maxWidth: '210mm', margin: '0 auto', padding: '20mm 15mm', fontFamily: 'sans-serif', fontSize: '12px', color: '#1e293b' }}>

        {/* Clinic Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1d4ed8', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1d4ed8' }}>BarOpt</div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
            {isAr ? 'فحص البصر والوصفات الطبية' : 'Optical Examination & Prescription'}
          </div>
        </div>

        {/* Patient Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px' }}>{isAr ? 'اسم المريض' : 'Patient Name'}: </span>
            <strong>{patient.fullName}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px' }}>{isAr ? 'رقم الملف' : 'File #'}: </span>
            <strong style={{ fontFamily: 'monospace' }}>{patient.fileNumber}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px' }}>{isAr ? 'تاريخ الفحص' : 'Exam Date'}: </span>
            <span>{fmtDate(examination.examinationDate)}</span>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px' }}>{isAr ? 'رقم الوصفة' : 'Rx #'}: </span>
            <strong style={{ fontFamily: 'monospace' }}>{rx.prescriptionNumber}</strong>
          </div>
          {rx.examinedBy && (
            <div>
              <span style={{ color: '#64748b', fontSize: '10px' }}>{isAr ? 'الفاحص' : 'Examiner'}: </span>
              <span>{rx.examinedBy}</span>
            </div>
          )}
          {rx.validUntil && (
            <div>
              <span style={{ color: '#64748b', fontSize: '10px' }}>{isAr ? 'صالحة حتى' : 'Valid Until'}: </span>
              <span>{fmtDate(rx.validUntil)}</span>
            </div>
          )}
        </div>

        {/* Prescription Table */}
        <div style={{ marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1d4ed8', color: 'white' }}>
                <th style={{ padding: '8px 12px', textAlign: isAr ? 'right' : 'left', fontWeight: 600, width: '30%' }}>
                  {isAr ? 'القياس' : 'Metric'}
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, width: '35%' }}>
                  OD {isAr ? '(العين اليمنى)' : '(Right Eye)'}
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, width: '35%' }}>
                  OS {isAr ? '(العين اليسرى)' : '(Left Eye)'}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.label} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>{r.label}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 500 }} dir="ltr">{r.od}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 500 }} dir="ltr">{r.os}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PD */}
        {hasPd && (
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <strong style={{ color: '#1d4ed8' }}>PD — {isAr ? 'بعد البؤبؤ' : 'Pupillary Distance'}</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
              {rx.pdDistance !== undefined && (
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{isAr ? 'بعيد' : 'Distance'}</div>
                  <div style={{ fontWeight: 600 }} dir="ltr">{rx.pdDistance} mm</div>
                </div>
              )}
              {rx.pdNear !== undefined && (
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{isAr ? 'قريب' : 'Near'}</div>
                  <div style={{ fontWeight: 600 }} dir="ltr">{rx.pdNear} mm</div>
                </div>
              )}
              {rx.rePd !== undefined && (
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>OD</div>
                  <div style={{ fontWeight: 600 }} dir="ltr">{rx.rePd} mm</div>
                </div>
              )}
              {rx.lePd !== undefined && (
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>OS</div>
                  <div style={{ fontWeight: 600 }} dir="ltr">{rx.lePd} mm</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {rx.notes && (
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
            <strong style={{ color: '#92400e' }}>{isAr ? 'ملاحظات' : 'Notes'}</strong>
            <p style={{ marginTop: '4px', color: '#1e293b' }}>{rx.notes}</p>
          </div>
        )}

        {/* Signature */}
        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '20px' }}>
              {isAr ? 'توقيع الفاحص' : 'Examiner Signature'}
            </div>
            {rx.examinedBy && <div style={{ fontWeight: 600 }}>{rx.examinedBy}</div>}
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{fmtDate(rx.prescriptionDate)}</div>
          </div>
          <div style={{ textAlign: isAr ? 'left' : 'right' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              {isAr ? 'صادر من' : 'Issued by'} BarOpt
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace' }}>
              {rx.prescriptionNumber}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
