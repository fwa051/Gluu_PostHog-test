import React from 'react'

export default function PaymentHistory({ items = [] }) {
  if (!items.length) return (
    <div className="text-sm text-gray-500">No payments yet.</div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600">
            <th className="px-2 py-1">Time</th>
            <th className="px-2 py-1">Provider</th>
            <th className="px-2 py-1">Status</th>
            <th className="px-2 py-1">Amount</th>
            <th className="px-2 py-1">Via</th>
            <th className="px-2 py-1">ID</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-2 py-1">{new Date(p.createdAt).toLocaleString()}</td>
              <td className="px-2 py-1">{p.provider}</td>
              <td className={`px-2 py-1 ${p.status === 'succeeded' ? 'text-emerald-700' :
                                        p.status === 'failed' ? 'text-red-700' : 'text-gray-700'}`}>
                {p.status}
              </td>
              <td className="px-2 py-1">
                {(p.amount/100).toFixed(2)} {p.currency?.toUpperCase()}
              </td>
              <td className="px-2 py-1">{p.via}</td>
              <td className="px-2 py-1">{p.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
