import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useURL } from "../urlConfig";
import DriveView from "../componets/DriveView";
import LeadershipManager from "../componets/LeadershipManager";
import MessagingDrawer from "../componets/MessagingDrawer";
import TasksPanel from "../componets/TasksPanel";
import AnnouncementBell from "../componets/AnnouncementBell";
import FeedbackButton from "../componets/FeedbackButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChartLine,
  faFolderOpen,
  faRightFromBracket,
  faUser,
  faX,
  faPlus,
  faClipboardList,
  faTrash,
  faPaperPlane,
  faArrowLeft,
  faCopy,
  faEye,
  faPen,
  faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";
import UpdateModal from '../componets/UpdateModal';
import appInfo from './info.json';

const helperTabs = [
  { id: "dashboard", label: "Dashboard", icon: faChartLine },
  { id: "forms", label: "Forms", icon: faClipboardList },
  { id: "inbox", label: "My Forms", icon: faClipboardList },
  { id: "drive", label: "Drive", icon: faFolderOpen },
];

const QUESTION_TYPES = [
  { id: "short", label: "Short answer" },
  { id: "paragraph", label: "Paragraph" },
  { id: "multiple_choice", label: "Multiple choice" },
  { id: "checkboxes", label: "Checkboxes" },
  { id: "dropdown", label: "Dropdown" },
];

const needsOptions = (type) =>
  type === "multiple_choice" || type === "checkboxes" || type === "dropdown";

const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;

const defaultHeaders = (extra = {}) => ({
  "ngrok-skip-browser-warning": "69420",
  ...extra,
});

const emptyQuestion = () => ({
  id: uid(),
  type: "short",
  question: "",
  required: false,
  options: [],
});

const emptyForm = () => ({
  id: uid(),
  title: "Untitled form",
  description: "",
  status: "draft",
  createdAt: new Date().toISOString(),
  questions: [emptyQuestion()],
  audiences: ["students"],
});

const AUDIENCES = [
  ["students", "Students"],
  ["mentor", "Mentors"],
  ["helper", "Helpers"],
  ["coach", "Coaches"],
  ["everyone", "Everyone"],
  ["subgroup:Manufacturing", "Manufacturing subgroup"],
  ["subgroup:Programming", "Programming subgroup"],
  ["subgroup:Design", "Design subgroup"],
  ["subgroup:Electronics", "Electronics subgroup"],
  ["subgroup:Media", "Media subgroup"],
];

export default function HelperPage({ roleLabel = "Helper" }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  const [forms, setForms] = useState([]);
  const [responses, setResponses] = useState([]);
  const [isLoadingForms, setIsLoadingForms] = useState(true);
  const [formError, setFormError] = useState("");
  const [formSubView, setFormSubView] = useState("list"); // list | builder
  const [editingFormId, setEditingFormId] = useState(null);
  const [viewingResponsesId, setViewingResponsesId] = useState(null);
  const [responsesOrigin, setResponsesOrigin] = useState("forms"); // forms | dashboard
  const visibleTabs = roleLabel === "Coach" ? [...helperTabs, { id: "leaders", label: "Leaders", icon: faUser }] : helperTabs;
    const [hasNewUpdate, setHasNewUpdate] = useState(false);

  useEffect(() => {
    // Check localStorage exactly once when the entire application mounts
    const lastSeenVersion = localStorage.getItem('app_version_seen');
    
    // Safety check: Don't trigger the modal on first-time load
    if (!lastSeenVersion) {
      localStorage.setItem('app_version_seen', appInfo.version);
    } else if (lastSeenVersion !== appInfo.version) {
      setHasNewUpdate(true);
    }
  }, []);

  const handleDismissUpdate = () => {
    localStorage.setItem('app_version_seen', appInfo.version);
    setHasNewUpdate(false);
  };

  useEffect(() => {
    fetchForms();
  }, []);

  useEffect(() => {
    if (viewingResponsesId) fetchResponses(viewingResponsesId);
  }, [viewingResponsesId]);

  const currentHelper = localStorage.getItem("currentUser") || roleLabel;

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    setIsSidebarOpen(false);
    setViewingResponsesId(null);
    if (tabId === "forms") setFormSubView("list");
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("userRole");
    navigate("/");
  };

  const apiHeaders = (extra = {}) => defaultHeaders({ "Content-Type": "application/json", ...extra });

  const fetchForms = async () => {
    setIsLoadingForms(true);
    setFormError("");
    try {
      const res = await fetch(`${useURL()}/helper/forms`, {
        headers: defaultHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load forms");
      setForms(data);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsLoadingForms(false);
    }
  };

  const fetchResponses = async (formId) => {
    setFormError("");
    try {
      const res = await fetch(`${useURL()}/helper/forms/${formId}/responses`, {
        headers: defaultHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load responses");
      setResponses(data);
      setForms((prev) =>
        prev.map((form) =>
          form.id === formId ? { ...form, responseCount: data.length } : form
        )
      );
    } catch (err) {
      setFormError(err.message);
    }
  };

  const saveForm = async (form) => {
    try {
      const res = await fetch(`${useURL()}/helper/forms/${form.id}`, {
        method: "PATCH",
        headers: apiHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save form");
      setFormError("");
    } catch (err) {
      setFormError(err.message);
    }
  };

  const applyFormChange = (formId, buildNextForm) => {
    const currentForm = forms.find((form) => form.id === formId);
    if (!currentForm) return;
    const updatedForm = buildNextForm(currentForm);
    setForms((prev) => prev.map((form) => (form.id === formId ? updatedForm : form)));
    saveForm(updatedForm);
  };

  const updateForm = (formId, patch) => {
    applyFormChange(formId, (form) => ({ ...form, ...patch }));
  };

  const updateQuestion = (formId, qId, patch) => {
    applyFormChange(formId, (form) => ({
      ...form,
      questions: form.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
    }));
  };

  const addQuestion = (formId) => {
    applyFormChange(formId, (form) => ({
      ...form,
      questions: [...form.questions, emptyQuestion()],
    }));
  };

  const deleteQuestion = (formId, qId) => {
    applyFormChange(formId, (form) => ({
      ...form,
      questions: form.questions.filter((q) => q.id !== qId),
    }));
  };

  const duplicateQuestion = (formId, qId) => {
    applyFormChange(formId, (form) => {
        const idx = form.questions.findIndex((q) => q.id === qId);
        if (idx === -1) return form;
        const copy = { ...form.questions[idx], id: uid() };
        const questions = [...form.questions];
        questions.splice(idx + 1, 0, copy);
        return { ...form, questions };
    });
  };

  const moveQuestion = (formId, qId, direction) => {
    applyFormChange(formId, (form) => {
        const idx = form.questions.findIndex((q) => q.id === qId);
        const newIdx = idx + direction;
        if (idx === -1 || newIdx < 0 || newIdx >= form.questions.length) return form;
        const questions = [...form.questions];
        [questions[idx], questions[newIdx]] = [questions[newIdx], questions[idx]];
        return { ...form, questions };
    });
  };

  const addOption = (formId, qId) => {
    applyFormChange(formId, (form) => ({
              ...form,
              questions: form.questions.map((q) =>
                q.id === qId
                  ? { ...q, options: [...q.options, `Option ${q.options.length + 1}`] }
                  : q
              ),
            }));
  };

  const updateOption = (formId, qId, idx, value) => {
    applyFormChange(formId, (form) => ({
              ...form,
              questions: form.questions.map((q) =>
                q.id === qId
                  ? {
                      ...q,
                      options: q.options.map((o, i) => (i === idx ? value : o)),
                    }
                  : q
              ),
            }));
  };

  const deleteOption = (formId, qId, idx) => {
    applyFormChange(formId, (form) => ({
              ...form,
              questions: form.questions.map((q) =>
                q.id === qId
                  ? { ...q, options: q.options.filter((_, i) => i !== idx) }
                  : q
              ),
            }));
  };

  const createForm = async () => {
    const newForm = emptyForm();
    try {
      const res = await fetch(`${useURL()}/helper/forms`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify(newForm),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error || "Failed to create form");
      setForms((prev) => [saved, ...prev]);
      setEditingFormId(saved.id);
      setFormSubView("builder");
      setFormError("");
    } catch (err) {
      setFormError(err.message);
    }
  };

  const editForm = (formId) => {
    setEditingFormId(formId);
    setFormSubView("builder");
  };

  const deleteForm = async (formId) => {
    try {
      const res = await fetch(`${useURL()}/helper/forms/${formId}`, {
        method: "DELETE",
        headers: defaultHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete form");
      }
      setForms((prev) => prev.filter((f) => f.id !== formId));
      setResponses([]);
      setFormError("");
    } catch (err) {
      setFormError(err.message);
    }
  };

  const sendForm = (formId) => {
    const form = forms.find((item) => item.id === formId);
    if (!form?.audiences?.length) {
      setFormError("Choose at least one recipient group before sending this form.");
      return false;
    }
    updateForm(formId, { status: "sent", sentAt: new Date().toISOString() });
    return true;
  };

  const openResponses = (formId, origin) => {
    setViewingResponsesId(formId);
    setResponsesOrigin(origin);
  };

  const editingForm = forms.find((f) => f.id === editingFormId);
  const responsesForm = forms.find((f) => f.id === viewingResponsesId);
  const sentForms = forms.filter((f) => f.status === "sent");

  return (
    <div className="admin-container fade-in">
      <MessagingDrawer />
      <div
        className={`mobileSidebarOverlay ${isSidebarOpen ? "active" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <FontAwesomeIcon icon={faX} id="closeBTN" />
      </div>

      <div className={`mobileSidebar ${isSidebarOpen ? "active" : ""}`}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            className={`admin-tab-btn-mobile ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => selectTab(tab.id)}
          >
            <FontAwesomeIcon icon={tab.icon} /> {tab.label}
          </button>
        ))}
      </div>

      <header className="admin-header">
        <img src="./pwa-512x512.png" id="imageLogo" height={60} alt="935 scouting logo" />
        <FontAwesomeIcon
          icon={faBars}
          id="mobileLogo"
          onClick={() => setIsSidebarOpen(true)}
        />

        <AnnouncementBell />
        <FeedbackButton />
        <div
          className="admin-profile-badge"
          onClick={() => setIsLogoutOpen((isOpen) => !isOpen)}
        >
          <FontAwesomeIcon id="mobileUser" icon={faUser} />
        </div>

        {isLogoutOpen && (
          <div id="logoutSection" style={{ display: "block" }}>
            <h2>Hello, {currentHelper}</h2>
            <button
              onClick={handleLogout}
              className="admin-logout-btn"
              id="adminLogout"
              title="Sign out"
            >
              <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
            </button>
          </div>
        )}
      </header>

      <div className="admin-tab-row">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            className={`admin-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => selectTab(tab.id)}
          >
            <FontAwesomeIcon icon={tab.icon} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-content-viewport">
        {viewingResponsesId && responsesForm ? (
          <FormResponses
            form={responsesForm}
            responses={responses}
            onBack={() => {
              setViewingResponsesId(null);
              setActiveTab(responsesOrigin);
            }}
          />
        ) : (
          <>
            {activeTab === "dashboard" && (
              <><TasksPanel /><DashboardTab sentForms={sentForms} onOpenResponses={(formId) => openResponses(formId, "dashboard")} /></>
            )}

            {activeTab === "drive" && (
              <DriveView />
            )}

            {activeTab === "inbox" && <FormInbox />}

            {activeTab === "leaders" && <LeadershipManager />}

            {activeTab === "forms" && formSubView === "list" && (
              <FormsList
                forms={forms}
                isLoading={isLoadingForms}
                error={formError}
                onCreate={createForm}
                onEdit={editForm}
                onDelete={deleteForm}
                onSend={sendForm}
                onViewResponses={(formId) => openResponses(formId, "forms")}
              />
            )}

            {activeTab === "forms" && formSubView === "builder" && editingForm && (
              <FormBuilder
                form={editingForm}
                onBack={() => setFormSubView("list")}
                onUpdateForm={updateForm}
                onUpdateQuestion={updateQuestion}
                onAddQuestion={addQuestion}
                onDeleteQuestion={deleteQuestion}
                onDuplicateQuestion={duplicateQuestion}
                onMoveQuestion={moveQuestion}
                onAddOption={addOption}
                onUpdateOption={updateOption}
                onDeleteOption={deleteOption}
                onSend={sendForm}
                formError={formError}
                setFormError={setFormError}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FormInbox() {
  const [forms, setForms] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const role = localStorage.getItem("userRole") || "";
    const subgroup = localStorage.getItem("userSubgroup") || "";
    fetch(`${useURL()}/forms/sent?role=${encodeURIComponent(role)}&subgroup=${encodeURIComponent(subgroup)}`, { headers: defaultHeaders() })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load forms");
        setForms(data);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <div className="forms-toolbar"><h1>My Forms</h1></div>
      {error && <p className="text-muted">{error}</p>}
      {forms.length === 0 ? <div className="form-empty-state"><FontAwesomeIcon icon={faClipboardList} /><p>No forms are waiting for you.</p></div> : (
        <div className="admin-forms-grid">
          {forms.map((form) => (
            <div key={form.id} className="admin-form-card">
              <div className="admin-form-card-header"><span className="admin-form-card-title">{form.title || "Untitled form"}</span><span className="admin-status-pill active">Open</span></div>
              <div className="admin-card-body"><p>{form.description}</p><p className="admin-form-card-meta">{form.questions.length} question{form.questions.length === 1 ? "" : "s"}</p></div>
              <div className="admin-form-card-actions"><Link to={`/form/${form.id}`} style={{ width: "100%" }}><button style={{ width: "100%" }}><FontAwesomeIcon icon={faEye} /> Fill form</button></Link></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardTab({ sentForms, onOpenResponses }) {
  return (
    <section>
      <h1>Dashboard</h1>

      <div className="dash-forms-panel">
        <div className="dash-forms-panel-header">
          <h3>Sent Forms</h3>
          <span className="admin-regionals-count">{sentForms.length} sent</span>
        </div>

        {sentForms.length === 0 ? (
          <div className="form-empty-state">
            <FontAwesomeIcon icon={faClipboardList} />
            <p>No forms sent yet. Head to the Forms tab to create and send one.</p>
          </div>
        ) : (
          <div className="dash-forms-list">
            {sentForms.map((form) => {
              const responseCount = form.responseCount || 0;
              return (
                <div key={form.id} className="dash-form-row" onClick={() => onOpenResponses(form.id)}>
                  <div className="admin-regional-main">
                    <span className="admin-regional-name">{form.title || "Untitled form"}</span>
                    <span className="admin-regional-meta">
                      {form.questions.length} question{form.questions.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="dash-form-response-count">
                    <FontAwesomeIcon icon={faEye} />
                    {responseCount} response{responseCount === 1 ? "" : "s"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function FormsList({ forms, isLoading, error, onCreate, onEdit, onDelete, onSend, onViewResponses }) {
  return (
    <section>
      <div className="forms-toolbar">
        <h1>Forms</h1>
        <button className="launch-btn accent forms-new-btn" onClick={onCreate}>
          <FontAwesomeIcon icon={faPlus} /> New Form
        </button>
      </div>

      {error && <p className="text-muted">{error}</p>}

      {isLoading ? (
        <div className="form-empty-state">
          <FontAwesomeIcon icon={faClipboardList} />
          <p>Loading forms...</p>
        </div>
      ) : forms.length === 0 ? (
        <div className="form-empty-state">
          <FontAwesomeIcon icon={faClipboardList} />
          <p>No forms yet. Create one to start collecting responses from students.</p>
        </div>
      ) : (
        <div className="admin-forms-grid">
          {forms.map((form) => {
            const responseCount = form.responseCount || 0;
            return (
              <div key={form.id} className="admin-form-card">
                <div className="admin-form-card-header">
                  <span className="admin-form-card-title">{form.title || "Untitled form"}</span>
                  <span className={`admin-status-pill ${form.status === "sent" ? "active" : ""}`}>
                    {form.status === "sent" ? "Sent" : "Draft"}
                  </span>
                </div>

                <div className="admin-card-body">
                  {form.description && <p>{form.description}</p>}
                  <p className="admin-form-card-meta">
                    {form.questions.length} question{form.questions.length === 1 ? "" : "s"}
                    {form.status === "sent" && ` · ${responseCount} response${responseCount === 1 ? "" : "s"}`}
                  </p>
                </div>

                <div className="admin-form-card-actions">
                  <button onClick={() => onEdit(form.id)} title="Edit">
                    <FontAwesomeIcon icon={faPen} /> Edit
                  </button>
                  {form.status === "sent" && (
                    <button onClick={() => onViewResponses(form.id)} title="View responses">
                      <FontAwesomeIcon icon={faEye} /> Responses
                    </button>
                  )}
                  {form.status !== "sent" && (
                    <button onClick={() => onEdit(form.id)} title="Send to students">
                      <FontAwesomeIcon icon={faPaperPlane} /> Send
                    </button>
                  )}
                  <button
                    className="admin-row-delete-btn"
                    onClick={() => onDelete(form.id)}
                    title="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FormBuilder({
  form,
  onBack,
  onUpdateForm,
  onUpdateQuestion,
  onAddQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  onMoveQuestion,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onSend,
  formError,
  setFormError,
}) {
  const shareLink =
    typeof window !== "undefined" ? `${window.location.origin}/form/${form.id}` : "";
  const [copied, setCopied] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  
  const selectedAudiences = form.audiences?.length ? form.audiences : ["students"];
  
  const toggleAudience = (audience) => {
    const next = selectedAudiences.includes(audience)
      ? selectedAudiences.filter((item) => item !== audience)
      : [...selectedAudiences, audience];
    onUpdateForm(form.id, { audiences: next });
    if (next.length > 0) setFormError("");
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleFinalSend = () => {
    const success = onSend(form.id);
    if (success) {
      setIsSendModalOpen(false);
    }
  };

  return (
    <section className="form-builder-container">
      <div className="form-builder-header">
        <button className="form-back-btn" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} /> Back to Forms
        </button>
        {form.status !== "sent" ? (
          <button className="launch-btn accent form-send-btn" onClick={() => setIsSendModalOpen(true)}>
            <FontAwesomeIcon icon={faPaperPlane} /> Send form
          </button>
        ) : (
          <span className="admin-status-pill active">
            <FontAwesomeIcon icon={faCircleCheck} /> Sent
          </span>
        )}
      </div>

      {form.status === "sent" && (
        <div className="form-share-link-box">
          <span>{shareLink}</span>
          <button onClick={copyLink}>
            <FontAwesomeIcon icon={faCopy} /> {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}

      <div className="form-title-card">
        <input
          className="form-title-input"
          value={form.title}
          placeholder="Untitled form"
          onChange={(e) => onUpdateForm(form.id, { title: e.target.value })}
        />
        <textarea
          className="form-desc-input"
          value={form.description}
          placeholder="Form description"
          rows={2}
          onChange={(e) => onUpdateForm(form.id, { description: e.target.value })}
        />
      </div>

      {form.questions.map((q, idx) => (
        <div className="form-question-card" key={q.id}>
          <div className="form-question-top-row">
            <input
              className="form-question-input"
              value={q.question}
              placeholder={`Question ${idx + 1}`}
              onChange={(e) => onUpdateQuestion(form.id, q.id, { question: e.target.value })}
            />
            <select
              className="form-type-select"
              value={q.type}
              onChange={(e) => {
                const type = e.target.value;
                onUpdateQuestion(form.id, q.id, {
                  type,
                  options: needsOptions(type) && q.options.length === 0 ? ["Option 1"] : q.options,
                });
              }}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {!needsOptions(q.type) && (
            <input
              className="form-answer-preview"
              disabled
              placeholder={q.type === "paragraph" ? "Long answer text" : "Short answer text"}
            />
          )}

          {needsOptions(q.type) && (
            <div className="form-options-list">
              {q.options.map((opt, oIdx) => (
                <div className="form-option-row" key={oIdx}>
                  <span className={`form-option-indicator ${q.type}`} />
                  <input
                    value={opt}
                    onChange={(e) => onUpdateOption(form.id, q.id, oIdx, e.target.value)}
                  />
                  <button
                    className="form-option-remove-btn"
                    onClick={() => onDeleteOption(form.id, q.id, oIdx)}
                  >
                    <FontAwesomeIcon icon={faX} />
                  </button>
                </div>
              ))}
              <button className="form-add-option-btn" onClick={() => onAddOption(form.id, q.id)}>
                + Add option
              </button>
            </div>
          )}

          <div className="form-question-footer">
            <div className="form-question-footer-left">
              <button
                className="form-question-move-btn"
                onClick={() => onMoveQuestion(form.id, q.id, -1)}
                disabled={idx === 0}
              >
                ▲
              </button>
              <button
                className="form-question-move-btn"
                onClick={() => onMoveQuestion(form.id, q.id, 1)}
                disabled={idx === form.questions.length - 1}
              >
                ▼
              </button>
            </div>

            <div className="form-question-footer-right">
              <button onClick={() => onDuplicateQuestion(form.id, q.id)} title="Duplicate">
                <FontAwesomeIcon icon={faCopy} />
              </button>
              <button onClick={() => onDeleteQuestion(form.id, q.id)} title="Delete">
                <FontAwesomeIcon icon={faTrash} />
              </button>
              <label className="form-toggle-switch">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => onUpdateQuestion(form.id, q.id, { required: e.target.checked })}
                />
                <span className="form-toggle-slider" />
              </label>
              <span className="form-required-label">Required</span>
            </div>
          </div>
        </div>
      ))}

      <button className="form-add-question-btn" onClick={() => onAddQuestion(form.id)}>
        <FontAwesomeIcon icon={faPlus} /> Add question
      </button>

      {isSendModalOpen && (
        <div className="form-modal-overlay">
          <div className="form-modal-window animate-pop">
            <button className="form-modal-close" onClick={() => setIsSendModalOpen(false)}>
              <FontAwesomeIcon icon={faX} />
            </button>
            <div className="form-modal-header">
              <h2>Send Form</h2>
              <p>Select all the recipient groups you want to give access to this form.</p>
            </div>
            
            {formError && <p className="form-modal-error">{formError}</p>}

            <div className="form-modal-audiences-grid">
              {AUDIENCES.map(([id, label]) => {
                const isSelected = selectedAudiences.includes(id);
                return (
                  <div 
                    key={id} 
                    className={`form-modal-audience-card ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleAudience(id)}
                  >
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>

            <div className="form-modal-footer">
              <button className="form-modal-cancel-btn" onClick={() => setIsSendModalOpen(false)}>
                Cancel
              </button>
              <button className="form-modal-confirm-btn" onClick={handleFinalSend}>
                <FontAwesomeIcon icon={faPaperPlane} /> Send Form
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FormResponses({ form, responses, onBack }) {
  return (
    <section className="form-builder-container">
      <div className="form-builder-header">
        <button className="form-back-btn" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} /> Back
        </button>
        <span className="admin-regionals-count">
          {responses.length} response{responses.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="form-title-card">
        <h2>{form.title || "Untitled form"}</h2>
        {form.description && <p>{form.description}</p>}
      </div>

      {responses.length === 0 ? (
        <div className="form-empty-state">
          <FontAwesomeIcon icon={faClipboardList} />
          <p>No responses yet. Responses will appear here once students submit the form.</p>
        </div>
      ) : (
        responses.map((response, rIdx) => (
          <div className="form-response-card" key={response.id || rIdx}>
            <div className="form-response-meta">
              Response {rIdx + 1}
              {response.submittedAt &&
                ` · ${new Date(response.submittedAt).toLocaleString()}`}
            </div>
            {form.questions.map((q) => (
              <div className="form-response-qa" key={q.id}>
                <span className="form-response-question">{q.question || "Untitled question"}</span>
                <span className="form-response-answer">
                  {Array.isArray(response.answers?.[q.id])
                    ? response.answers[q.id].join(", ") || "—"
                    : response.answers?.[q.id] || "—"}
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
