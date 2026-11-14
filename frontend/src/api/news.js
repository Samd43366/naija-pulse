import { apiRequest } from './client'

export function fetchNews({ state, category, search, limit = 30 } = {}) {
  const params = new URLSearchParams()
  if (state) params.set('state', state)
  if (category) params.set('category', category)
  if (search) params.set('search', search)
  params.set('limit', String(limit))
  return apiRequest(`/api/v1/news?${params.toString()}`)
}

