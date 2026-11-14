import { apiRequest } from './client'
import { answerLocally } from '../lib/localPulseBrain'

// Sends a user question to FastAPI's trained PulseAI RAG endpoint (`POST /api/v1/chat`),
// passing compact live incident metadata so newly created citizen reports & agency dispatches
// are reflected in real time. Automatically falls back to `localPulseBrain` if offline!
export async function askPulseAi(message, incidents = []) {
  try {
    const compactIncidents = incidents.map((inc) => ({
      title: inc.title,
      summary: inc.summary,
      category_code: inc.category_code,
      state_name: inc.state_name,
      lga_name: inc.lga_name,
      trust_score: inc.trust_score,
      status: inc.status,
      agency_status: inc.agency_status,
      lat: inc.latitude,
      lng: inc.longitude,
    }))

    return await apiRequest('/api/v1/chat', {
      method: 'POST',
      body: {
        message,
        incidents: compactIncidents,
      },
    })
  } catch {
    return answerLocally(message, incidents)
  }
}
