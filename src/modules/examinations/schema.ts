import { z } from 'zod'

// ── Helper: optional number with range validation ─────────────────────────────

function optNum(min: number, max: number) {
  return z.preprocess(
    (v) => {
      if (v === '' || v === undefined || v === null) return undefined
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isNaN(n) ? undefined : n
    },
    z.number().min(min).max(max).optional(),
  )
}

function optStr() {
  return z.string().max(100).optional().or(z.literal(''))
}

// ── Examination form schema ───────────────────────────────────────────────────

export const ExaminationFormSchema = z.object({
  examinationDate: z.string().min(1, 'تاريخ الفحص مطلوب / Date required'),
  examinedBy:      optStr(),
  examType:        z.enum(['distance', 'near', 'comprehensive', 'recheck']).default('comprehensive'),

  // OD (Right eye)
  reSphere:        optNum(-30, 30),
  reCylinder:      optNum(-10, 10),
  reAxis:          optNum(0, 180),
  reAdd:           optNum(0, 4),
  rePrismPower:    optNum(0, 20),
  rePrismBase:     optStr(),
  visualAcuityRight: optStr(),
  rePd:            optNum(20, 50),

  // OS (Left eye)
  leSphere:        optNum(-30, 30),
  leCylinder:      optNum(-10, 10),
  leAxis:          optNum(0, 180),
  leAdd:           optNum(0, 4),
  lePrismPower:    optNum(0, 20),
  lePrismBase:     optStr(),
  visualAcuityLeft: optStr(),
  lePd:            optNum(20, 50),

  // Binocular PD
  pdDistance:      optNum(40, 80),
  pdNear:          optNum(40, 80),

  // Additional VA
  unaidedVARight:  optStr(),
  unaidedVALeft:   optStr(),
  bcvaRight:       optStr(),
  bcvaLeft:        optStr(),

  notes:           z.string().max(1000).optional().or(z.literal('')),
})

export type ExaminationFormValues = z.infer<typeof ExaminationFormSchema>

// ── Prescription form schema ──────────────────────────────────────────────────

export const PrescriptionFormSchema = z.object({
  prescriptionDate: z.string().min(1, 'تاريخ الوصفة مطلوب / Date required'),
  examinedBy:       optStr(),
  validUntil:       optStr(),

  // OD
  reSphere:        optNum(-30, 30),
  reCylinder:      optNum(-10, 10),
  reAxis:          optNum(0, 180),
  reAdd:           optNum(0, 4),
  rePrismPower:    optNum(0, 20),
  rePrismBase:     optStr(),
  reVA:            optStr(),
  rePd:            optNum(20, 50),

  // OS
  leSphere:        optNum(-30, 30),
  leCylinder:      optNum(-10, 10),
  leAxis:          optNum(0, 180),
  leAdd:           optNum(0, 4),
  lePrismPower:    optNum(0, 20),
  lePrismBase:     optStr(),
  leVA:            optStr(),
  lePd:            optNum(20, 50),

  // PD
  pdDistance:      optNum(40, 80),
  pdNear:          optNum(40, 80),

  lensType:        optStr(),
  notes:           z.string().max(1000).optional().or(z.literal('')),
})

export type PrescriptionFormValues = z.infer<typeof PrescriptionFormSchema>
