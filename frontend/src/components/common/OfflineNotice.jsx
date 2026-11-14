import { useEffect, useState } from 'react'
import { MessageSquareWarning, WifiOff } from 'lucide-react'

// Feature 3: Offline / Low-Data SMS Fallback.
// Listens to browser online/offline events. Also exposes an always-accessible
// SMS link formatted for `/api/v1/webhooks/sms` (Africa's Talking / Twilio format).
export default function OfflineNotice({ forceShow = false }) {
  const [browserOffline, setBrowserOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )

  useEffect(() => {
    const goOnline = () => setBrowserOffline(false)
    const goOffline = () => setBrowserOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (!browserOffline && !forceShow) return null

  const smsHref =
    'sms:+23480062452?body=' +
    encodeURIComponent('FLOOD Lekki Toll Gate water rising above road level')

  return (
    <div className="anim-fade flex items-center justify-between gap-3 border-b border-warn/30 bg-warn/12 px-4 py-2 text-xs text-ink-2">
      <span className="flex items-center gap-2">
        {browserOffline ? (
          <WifiOff size={15} className="text-warn" />
        ) : (
          <MessageSquareWarning size={15} className="text-warn" />
        )}
        <span>
          <strong className="text-ink">
            {browserOffline ? 'No internet connection.' : 'Low data or 2G?'}
          </strong>{' '}
          You can still report by SMS.
        </span>
      </span>
      <a href={smsHref} className="btn bg-warn !px-3 !py-1.5 text-xs text-white hover:brightness-110">
        Send SMS report
      </a>
    </div>
  )
}
