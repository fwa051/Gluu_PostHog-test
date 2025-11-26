export type Payment = {
  id: string
  amount: number
  status: 'success' | 'fail'
  createdAt?: string
  [k: string]: unknown
}

type Props = {
  items: Payment[]
}

export default function PaymentHistory({ items }: Props) {
  if (!items?.length) {
    return <div className="text-sm text-gray-500">No payments yet.</div>
  }
  return (
    <ul className="divide-y divide-gray-200 text-sm">
      {items.map(p => (
        <li key={p.id} className="py-2 flex items-center justify-between">
          <span>{p.createdAt ?? '—'}</span>
          <span className={p.status === 'success' ? 'text-green-600' : 'text-red-600'}>
            {p.status}
          </span>
          <span>${p.amount}</span>
        </li>
      ))}
    </ul>
  )
}
