import { z } from 'zod'

const stringArray = z
  .preprocess(
    v => (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n').map(s => s.trim()).filter(Boolean) : []),
    z.array(z.string().min(1)),
  )

export const MedicalHistoryFormSchema = z.object({
  chronicConditions: stringArray.default([]),
  hasDiabetes: z.boolean().default(false),
  hasHypertension: z.boolean().default(false),
  allergies: stringArray.default([]),
  medications: stringArray.default([]),
  previousSurgeries: stringArray.default([]),
  additionalNotes: z.string().optional(),
})

export const OcularHistoryFormSchema = z.object({
  previousEyeConditions: stringArray.default([]),
  eyeSurgeries: stringArray.default([]),
  eyeInjuries: stringArray.default([]),
  previousGlasses: z.boolean().default(false),
  previousContactLenses: z.boolean().default(false),
  lastEyeExamDate: z.string().optional(),
  familyEyeHistory: z.string().optional(),
  additionalNotes: z.string().optional(),
})

export const SymptomFormSchema = z.object({
  symptomType: z.enum([
    'blurry_vision', 'headache', 'eye_strain',
    'near_difficulty', 'far_difficulty',
    'photophobia', 'dry_eye', 'other',
  ]),
  eye: z.enum(['OD', 'OS', 'OU']),
  onsetDate: z.string().optional(),
  description: z.string().optional(),
})

export type MedicalHistoryFormValues = z.infer<typeof MedicalHistoryFormSchema>
export type OcularHistoryFormValues = z.infer<typeof OcularHistoryFormSchema>
export type SymptomFormValues = z.infer<typeof SymptomFormSchema>
