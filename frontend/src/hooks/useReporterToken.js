import { useState } from 'react'
import { getReporterToken } from '../lib/reporterToken'

// Hook wrapper so components can read the token. The lazy initialiser
// (passing a function to useState) makes sure it only runs once, on first render.
export function useReporterToken() {
  const [token] = useState(() => getReporterToken())
  return token
}
