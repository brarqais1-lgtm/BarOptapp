import { z } from 'zod'

export const PatientFormSchema = z.object({
  fullName: z.string().min(1, 'الاسم مطلوب').max(120),
  phone: z.string().max(20).optional().or(z.literal('')),
  phone2: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('بريد إلكتروني غير صالح').optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  gender: z.enum(['male', 'female']).optional(),
  address: z.string().max(255).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
})

export type PatientFormValues = z.infer<typeof PatientFormSchema>

/** Full patient write input — includes system fields */
export interface PatientCreateInput extends PatientFormValues {
  fileNumber: string
  fullNameNormalized: string
  phoneNormalized?: string
}
