import React, { useState } from 'react'
import { api } from '../api.js'
import posthog from '../posthog.js'

export default function UploadWidget({ user, onChange }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const disabled = !user || (user.uploads >= user.quota) || loading

  const handleUpload = async () => {
    setMessage('')
    setLoading(true)
    posthog?.capture('upload_attempt')
    try {
      const res = await api.post('/upload')
      const { uploads, quota, quotaPct } = res.data
      onChange({ uploads, quota })
      posthog?.setPersonProperties({ has_uploaded_image: true, quota_pct: quotaPct })
      posthog?.capture('upload_success', { uploads, quota, quotaPct })

      if (quotaPct >= 0.8 && quotaPct < 1) {
        posthog?.capture('quota_near_limit', { uploads, quota, quotaPct })
        setMessage('Near free limit — consider upgrading.')
      }
      if (quotaPct >= 1) {
        posthog?.capture('quota_reached', { uploads, quota, quotaPct })
        setMessage('Quota reached — uploads disabled.')
      }
    } catch (e) {
      const msg = e?.response?.data?.error || 'Upload failed'
      setMessage(msg)
      posthog?.capture('upload_failed', { reason: msg })
    } finally {
      setLoading(false)
    }
  }

  const clearBanner = () => {
    setMessage('')
    posthog?.capture('upload_banner_cleared')
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Image Upload (simulated)</h3>
        <div className="badge">{user?.plan === 'premium' ? 'Premium quota' : 'Free quota'}</div>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Used <b>{user?.uploads ?? 0}</b> of <b>{user?.quota ?? 0}</b>
      </p>

      {message && (
        <div className={`mb-3 rounded-md border px-3 py-2 text-sm ${
          message.toLowerCase().includes('failed') ? 'border-red-200 bg-red-50 text-red-700'
          : message.toLowerCase().includes('quota') ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
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
        <button type="button" onClick={clearBanner} className="btn-ghost">
          Clear
        </button>
      </div>
    </div>
  )
}
