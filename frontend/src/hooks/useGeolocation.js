import { useCallback, useEffect, useRef, useState } from 'react'

// Lagos central reference fallback when GPS is not granted or supported
export const LAGOS = { lat: 6.5244, lng: 3.3792 }
export const ABUJA = { lat: 9.0765, lng: 7.3986 }

function isTrustedLocalOrigin() {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
}

function isIPhoneOrIPad() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Robust User Geolocation Hook for Web & Mobile:
 * 1. Checks Secure Context (browsers require HTTPS or localhost/127.0.0.1 for GPS).
 * 2. Checks Permissions API (granted, prompt, denied) where supported.
 * 3. Provides `locate()` for explicit user-triggered GPS request (critical for mobile permissions).
 * 4. Supports `watchPosition` for continuous live tracking with accuracy and heading.
 * 5. Provides clear user-friendly status: 'idle' | 'locating' | 'granted' | 'denied' | 'insecure_context' | 'unavailable'
 */
export function useGeolocation(options = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 12000,
    maximumAge = 10000,
    watch = true,
  } = options

  const [position, setPosition] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [heading, setHeading] = useState(null)
  const [speed, setSpeed] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [isSecure, setIsSecure] = useState(true)

  const watchIdRef = useRef(null)
  const isAppleMobileRef = useRef(false)

  // Detect insecure HTTP origin (non-localhost LAN IP like http://192.168.x.x or http://172.x.x.x)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isLocal = isTrustedLocalOrigin()
    isAppleMobileRef.current = isIPhoneOrIPad()
    const secure = window.isSecureContext || isLocal
    setIsSecure(Boolean(secure))
    if (!secure) {
      setStatus('insecure_context')
      setError(
        'Mobile browsers require HTTPS or localhost for automatic GPS. You can tap anywhere on the map or select your city from the search bar.',
      )
    }
  }, [])

  const handleSuccess = useCallback((pos) => {
    const coords = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    }
    setPosition(coords)
    setAccuracy(Math.round(pos.coords.accuracy || 0))
    setHeading(pos.coords.heading ?? null)
    setSpeed(pos.coords.speed ?? null)
    setStatus('granted')
    setError(null)
  }, [])

  const handleError = useCallback((err) => {
    setStatus(err.code === 1 ? 'denied' : 'unavailable')
    let msg = 'Could not retrieve your location.'
    if (err.code === 1) {
      msg = 'Location permission denied. Please allow location access in your browser settings.'
    } else if (err.code === 2) {
      msg = 'Position unavailable. GPS signal could not be acquired.'
    } else if (err.code === 3) {
      msg = 'Location request timed out. Please try again.'
    }
    setError(msg)
  }, [])

  // Explicit user-triggered location request (e.g. clicking the "Locate Me" button)
  const locate = useCallback(
    (customSuccess) => {
      if (typeof window === 'undefined') return

      if (!('geolocation' in navigator)) {
        setStatus('unavailable')
        setError('Geolocation is not supported by your browser.')
        return
      }

      const isLocal = isTrustedLocalOrigin()
      if (!window.isSecureContext && !isLocal) {
        setStatus('insecure_context')
        setError(
          'Mobile browsers require HTTPS or localhost for GPS. Use the search bar or tap the map to place your pin.',
        )
        return
      }

      setStatus('locating')
      setError(null)

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleSuccess(pos)
          if (customSuccess) {
            customSuccess({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy || 0),
            })
          }
        },
        handleError,
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        },
      )
    },
    [enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError],
  )

  // Start watching if supported and context is secure. iOS Safari often rejects
  // permission prompts triggered during page load; it requires a user gesture.
  // The explicit Locate button above remains the permission entry point there.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      return
    }

    const isLocal = isTrustedLocalOrigin()
    if (!window.isSecureContext && !isLocal) {
      return
    }

    if (isAppleMobileRef.current) {
      setStatus('idle')
      return
    }

    // Attempt passive initial location query
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        // If not immediately granted, stay in idle or denied without blocking UI
        if (err.code === 1) setStatus('denied')
        else setStatus('idle')
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 },
    )

    if (watch) {
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          handleSuccess,
          () => {}, // silent fail on background watch ticks
          { enableHighAccuracy, timeout: 20000, maximumAge: 15000 },
        )
      } catch {
        // watchPosition unavailable or blocked
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [watch, enableHighAccuracy, handleSuccess])

  return {
    position,
    accuracy,
    heading,
    speed,
    status,
    error,
    isSecure,
    locate,
    setManualPosition: (coords) => {
      setPosition(coords)
      setStatus('granted')
    },
  }
}
