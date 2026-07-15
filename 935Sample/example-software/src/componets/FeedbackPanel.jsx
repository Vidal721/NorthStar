import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";

const labels = { bug: "Bug report", feature: "Feature request", improvement: "Improvement", other: "Other" };

export default function FeedbackPanel() {
  const api = useURL();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await fetch(`${api}/feedback?actor=${encodeURIComponent(localStorage.getItem("currentUser") || "")}`, { headers: { "ngrok-skip-browser-warning": "69420" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load feedback.");
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [api]);

  async function updateStatus(item, status) {
    try {
      const response = await fetch(`${api}/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "69420" },
        body: JSON.stringify({ actor: localStorage.getItem("currentUser"), status }),
      });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || "Could not update feedback.");
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
    } catch (err) { setError(err.message); }
  }

  if (loading) return <p className="text-muted text-center p-md">Loading feedback…</p>;
  return <section className="feedback-panel">
    <div className="feedback-panel-heading"><div><span className="scout-overline">Community input</span><h3>Feedback</h3><p>Mark an item implemented to notify the person who submitted it.</p></div><span className="admin-regionals-count">{items.filter((item) => item.status === "open").length} open</span></div>
    {error && <p className="feedback-status feedback-error">{error}</p>}
    <div className="feedback-list">{items.length === 0 ? <p className="text-muted text-center p-md">No feedback has been submitted yet.</p> : items.map((item) => <article key={item.id} className={`feedback-item ${item.status}`}>
      <div className="feedback-item-main"><div className="feedback-meta"><span>{labels[item.category]}</span><span>{item.submitted_by}</span><span>{new Date(item.created_at).toLocaleDateString()}</span></div><h4>{item.title}</h4><p>{item.details}</p></div>
      <button className={`feedback-complete-btn ${item.status}`} onClick={() => updateStatus(item, item.status === "complete" ? "open" : "complete")} title={item.status === "complete" ? "Reopen feedback" : "Mark implemented and notify submitter"}><FontAwesomeIcon icon={item.status === "complete" ? faRotateLeft : faCheck} /> {item.status === "complete" ? "Reopen" : "Implemented"}</button>
    </article>)}</div>
  </section>;
}
