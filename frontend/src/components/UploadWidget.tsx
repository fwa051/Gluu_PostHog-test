// src/components/UploadWidget.tsx
import { useState } from 'react'
import { api } from '../api'
import posthog from '../posthog'

type User = {
  uploads?: number
  quota?: number
  [k: string]: unknown
}

type Props = {
  user: User | null
  onChange: (patch: Partial<User>) => void
}

// Your /upload returns { uploads, quota }
type UploadResp = { uploads: number; quota: number }

export default function UploadWidget({ user, onChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const uploads = user?.uploads ?? 0
  const quota   = user?.quota ?? 0
  const isAtOrOverQuota =
    typeof uploads === 'number' &&
    typeof quota === 'number' &&
    quota > 0 &&
    uploads >= quota

  const disabled = !user || loading || isAtOrOverQuota

  const handleUpload = async () => {
    setMessage('')
    setLoading(true)
    posthog.capture('upload_attempt')

    try {
      const res = await api.post<UploadResp>('/upload')
      const { uploads: nextUploads, quota: nextQuota } = res.data

      // Update parent state
      onChange({ uploads: nextUploads, quota: nextQuota })

      // Compute quotaPct locally as a fraction (0..1)
      const quotaPct = nextUploads / Math.max(1, nextQuota)

      // Analytics
      ;(posthog as any).setPersonProperties?.({
        has_uploaded_image: true,
        quota_pct: quotaPct,
      })
      posthog.capture('upload_success', {
        uploads: nextUploads,
        quota: nextQuota,
        quotaPct,
      })

      if (quotaPct >= 0.8 && quotaPct < 1) {
        posthog.capture('quota_near_limit', {
          uploads: nextUploads,
          quota: nextQuota,
          quotaPct,
        })
        setMessage('Near free limit — consider upgrading.')
      } else if (quotaPct >= 1) {
        posthog.capture('quota_reached', {
          uploads: nextUploads,
          quota: nextQuota,
          quotaPct,
        })
        setMessage('Quota reached — uploads disabled.')
      } else {
        setMessage('Upload succeeded.')
      }
    } catch (e: any) {
      const msg: string = e?.response?.data?.error || 'Upload failed'
      setMessage(msg)
      posthog.capture('upload_failed', { reason: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Image Upload (simulated)</h3>
        <div className="badge">Quota</div>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        Used <b>{uploads}</b> of <b>{quota}</b>
      </p>

      {message && (
        <div
          className={`mb-3 rounded-md border px-3 py-2 text-sm ${
            /failed/i.test(message)
              ? 'border-red-200 bg-red-50 text-red-700'
              : /quota/i.test(message)
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {message}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleUpload}
          disabled={disabled}
          className={`btn-primary ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Uploading…' : 'Upload one image'}
        </button>
        <button onClick={() => setMessage('')} className="btn-ghost">
          Clear
        </button>
      </div>
    </div>
  )
}
