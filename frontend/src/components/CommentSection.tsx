/**
 * Inert stub with the fixed public signature. The "Implement the ticket
 * comment section" ticket replaces the body and owns the behaviour.
 */
export default function CommentSection({ ticketId }: { ticketId: number }) {
  return (
    <div className="card" data-testid="comment-section" data-ticket-id={ticketId}>
      Kommentare werden in einem späteren Ticket umgesetzt.
    </div>
  )
}
