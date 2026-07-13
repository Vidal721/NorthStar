import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faCircleCheck,
  faClipboardList,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";

const needsOptions = (type) =>
  type === "multiple_choice" || type === "checkboxes" || type === "dropdown";

const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;

const defaultHeaders = (extra = {}) => ({
  "ngrok-skip-browser-warning": "69420",
  ...extra,
});

export default function StudentFormsPage() {
  const { formId } = useParams();
  return formId ? <StudentFormDetail formId={formId} /> : <StudentFormsList />;
}

function StudentShell({ children }) {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("userRole");
    navigate("/");
  };

  return (
    <div className="admin-container fade-in">
      <header className="admin-header">
        <img src="/pwa-512x512.png" id="imageLogo" height={60} alt="935 scouting logo" />
        <button className="admin-logout-btn" onClick={logout}>
          <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
        </button>
        <button className="student-header-btn" onClick={logout}>
           Drive
        </button>
        <button className="student-header-btn" onClick={logout}>
           Settings
        </button>
        <button className="student-header-btn" onClick={logout}>
           Subgroup
        </button>
      </header>
      <div className="admin-content-viewport">{children}</div>
    </div>
  );
}

function StudentFormsList() {
  const [forms, setForms] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadForms() {
      try {
        const res = await fetch(`${useURL()}/forms/sent`, {
          headers: defaultHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load forms");
        
        // Retrieve already submitted forms from localStorage
        const submittedForms = JSON.parse(localStorage.getItem("submittedForms") || "[]");
        
        // Filter out forms that match the submitted IDs
        const openForms = data.filter((form) => !submittedForms.includes(form.id));

        setForms(openForms);
        setStatus("ready");
      } catch (err) {
        setError(err.message);
        setStatus("error");
      }
    }

    loadForms();
  }, []);

  return (
    <StudentShell>
      <section>
        <div className="forms-toolbar">
          <h1>Forms</h1>
        </div>

        {status === "loading" && (
          <div className="form-empty-state">
            <FontAwesomeIcon icon={faClipboardList} />
            <p>Loading forms...</p>
          </div>
        )}

        {status === "error" && (
          <div className="form-empty-state">
            <FontAwesomeIcon icon={faClipboardList} />
            <p>{error}</p>
          </div>
        )}

        {status === "ready" && forms.length === 0 && (
          <div className="form-empty-state">
            <FontAwesomeIcon icon={faClipboardList} />
            <p>No forms are open right now.</p>
          </div>
        )}

        {status === "ready" && forms.length > 0 && (
          <div className="admin-forms-grid">
            {forms.map((form) => (
              <div key={form.id}>
                <Link className="admin-form-card student-form-link" to={`/form/${form.id}`}>
                  <div className="admin-form-card-header">
                    <span className="admin-form-card-title">{form.title || "Untitled form"}</span>
                    <span className="admin-status-pill active">Open</span>
                  </div>
                  <div className="admin-card-body">
                    {form.description && <p>{form.description}</p>}
                    <p className="admin-form-card-meta">
                      {form.questions.length} question{form.questions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </StudentShell>
  );
}

function StudentFormDetail({ formId }) {
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function loadForm() {
      try {
        const res = await fetch(`${useURL()}/forms/${formId}`, {
          headers: defaultHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load form");
        setForm(data);
        setStatus("ready");
      } catch (err) {
        setError(err.message);
        setStatus("error");
      }
    }

    loadForm();
  }, [formId]);

  const updateAnswer = (question, value) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const toggleCheckbox = (question, option) => {
    const current = Array.isArray(answers[question.id]) ? answers[question.id] : [];
    updateAnswer(
      question,
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
  };

  const submit = async () => {
    setError("");
    const missing = (form.questions || []).find((question) => {
      if (!question.required) return false;
      const answer = answers[question.id];
      return Array.isArray(answer) ? answer.length === 0 : !String(answer || "").trim();
    });

    if (missing) {
      setError(`Please answer: ${missing.question || "Untitled question"}`);
      return;
    }

    try {
      const res = await fetch(`${useURL()}/forms/${form.id}/responses`, {
        method: "POST",
        headers: defaultHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          id: uid(),
          respondent: localStorage.getItem("currentUser") || "",
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit form");

      // Save this form ID to localStorage so it gets filtered out from the dashboard list
      const submitted = JSON.parse(localStorage.getItem("submittedForms") || "[]");
      if (!submitted.includes(form.id)) {
        submitted.push(form.id);
        localStorage.setItem("submittedForms", JSON.stringify(submitted));
      }

      setStatus("submitted");
      navigate("/student");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <StudentShell>
      <section className="form-builder-container">
        <div className="form-builder-header">
          <Link className="form-back-btn" to="/student">
            <FontAwesomeIcon icon={faArrowLeft} /> Back to Forms
          </Link>
        </div>

        {status === "loading" && (
          <div className="form-empty-state">
            <FontAwesomeIcon icon={faClipboardList} />
            <p>Loading form...</p>
          </div>
        )}

        {status === "error" && (
          <div className="form-empty-state">
            <FontAwesomeIcon icon={faClipboardList} />
            <p>{error}</p>
          </div>
        )}

        {status === "submitted" && (
          <div className="form-empty-state">
            <FontAwesomeIcon icon={faCircleCheck} />
            <p>Your response has been submitted.</p>
          </div>
        )}

        {status === "ready" && form && (
          <>
            <div className="form-title-card">
              <h2>{form.title || "Untitled form"}</h2>
              {form.description && <p>{form.description}</p>}
            </div>

            {form.questions.map((question) => (
              <div className="form-question-card" key={question.id}>
                <label className="form-student-question">
                  {question.question || "Untitled question"}
                  {question.required && <span> *</span>}
                </label>

                {!needsOptions(question.type) && (
                  <textarea
                    className="form-desc-input student-answer-input"
                    rows={question.type === "paragraph" ? 4 : 1}
                    value={answers[question.id] || ""}
                    onChange={(event) => updateAnswer(question, event.target.value)}
                  />
                )}

                {question.type === "dropdown" && (
                  <select
                    className="form-type-select student-answer-select"
                    value={answers[question.id] || ""}
                    onChange={(event) => updateAnswer(question, event.target.value)}
                  >
                    <option value="">Choose one</option>
                    {(question.options || []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {question.type === "multiple_choice" && (
                  <div className="student-choice-list">
                    {(question.options || []).map((option) => (
                      <label key={option} className="student-choice-row">
                        <input
                          type="radio"
                          name={question.id}
                          checked={answers[question.id] === option}
                          onChange={() => updateAnswer(question, option)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.type === "checkboxes" && (
                  <div className="student-choice-list">
                    {(question.options || []).map((option) => (
                      <label key={option} className="student-choice-row">
                        <input
                          type="checkbox"
                          checked={(answers[question.id] || []).includes(option)}
                          onChange={() => toggleCheckbox(question, option)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {error && <p className="text-muted">{error}</p>}
            <button className="launch-btn accent form-send-btn" onClick={submit}>
              Submit
            </button>
          </>
        )}
      </section>
    </StudentShell>
  );
}