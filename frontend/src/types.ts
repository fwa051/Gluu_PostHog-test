// src/types.ts
export type Plan = 'free' | 'plus' | 'premium'

export type User = {
  email: string
  plan?: Plan
  uploads?: number
  quota?: number
  [k: string]: unknown
}
