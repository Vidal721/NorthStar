import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";

export default function FeedbackButton() {
  const api = useURL();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState("bug");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      setStatus("");
    }
  };

  async function submit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");
    try {
      const response = await fetch(`${api}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "69420" },
        body: JSON.stringify({
          actor: localStorage.getItem("currentUser"),
          category,
          title,
          details,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit feedback.");
      setTitle("");
      setDetails("");
      setStatus("Thanks — your feedback has been sent to the team.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button className="feedback-trigger" onClick={() => setIsOpen(true)} title="Send feedback">
        <FontAwesomeIcon icon={faCommentDots} /> <span>Feedback</span>
      </button>
      {isOpen && (
        <div className="feedback-modal-backdrop" onMouseDown={close}>
          <section className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="feedback-modal-heading">
              <div>
                <h2 id="feedback-title">Send feedback</h2>
                <p>Report a bug, request a feature, or share an idea.</p>
              </div>
              <button className="feedback-close" onClick={close} aria-label="Close feedback form"><FontAwesomeIcon icon={faXmark} /></button>
            </div>
            <form onSubmit={submit}>
              <label>Type
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="bug">Bug report</option>
                  <option value="feature">Feature request</option>
                  <option value="improvement">Improvement</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>Short title
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength="160" required placeholder="What would you like us to know?" />
              </label>
              <label>Details
                <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength="4000" required rows="5" placeholder="Include steps, context, or how this would help." />
              </label>
              {status && <p className="feedback-status" role="status">{status}</p>}
              <button className="feedback-submit" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Send feedback"}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
