// src/api.ts
import axios from 'axios'

// Use a relative base and let Vite proxy to the backend in dev.
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})
