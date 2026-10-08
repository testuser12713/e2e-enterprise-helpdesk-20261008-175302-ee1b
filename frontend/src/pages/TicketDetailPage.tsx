import { useParams } from 'react-router-dom'
import CommentSection from '../components/CommentSection'

/** Inert stub — the "Implement the ticket detail page" ticket fills this. */
export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const ticketId = Number(id)

  return (
    <section className="page-section" data-testid="page-ticket-detail">
      <header className="page-header">
        <h1>Ticket {id}</h1>
      </header>
      <div className="card">
        Diese Seite wird in einem späteren Ticket umgesetzt.
      </div>
      {Number.isFinite(ticketId) && <CommentSection ticketId={ticketId} />}
    </section>
  )
}
