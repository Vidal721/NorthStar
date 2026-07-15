import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChartLine,
  faFolderOpen,
  faRightFromBracket,
  faUser,
  faX,
  faClipboardList,
  faEye,
  faArrowLeft,
  faCircleCheck,
  faFolder,
  faFile,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";
import SharedDriveView from "../componets/DriveView";
import MessagingDrawer from "../componets/MessagingDrawer";
import TasksPanel from "../componets/TasksPanel";
import AnnouncementBell from "../componets/AnnouncementBell";
import FeedbackButton from "../componets/FeedbackButton";
import UpdateModal from '../componets/UpdateModal';
import appInfo from './info.json';

const apiBaseUrl = useURL();

const needsOptions = (type) =>
  type === "multiple_choice" || type === "checkboxes" || type === "dropdown";

const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;

const defaultHeaders = (extra = {}) => ({
  "ngrok-skip-browser-warning": "69420",
  ...extra,
});

let currentPath = "uploads";

const studentTabs = [
  { id: "dashboard", label: "Dashboard", icon: faChartLine },
  { id: "forms", label: "Forms", icon: faClipboardList },
  { id: "drive", label: "Drive", icon: faFolderOpen },
  { id: "subgroup", label: "Subgroup", icon: faFolderOpen },
  { id: "settings", label: "Settings", icon: faFolderOpen },
];

// MAIN ROUTER / VIEW CONTROLLER
export default function StudentFormsPage() {
  const { formId } = useParams();
  const [activeTab, setActiveTab] = useState("forms");
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

  if (formId) {
    return (
      <StudentShell 
        activeTab="forms" 
        setActiveTab={setActiveTab}
        hasNewUpdate={hasNewUpdate}
        handleDismissUpdate={handleDismissUpdate}
      >
        <StudentFormDetail formId={formId} />
      </StudentShell>
    );
  }

  return (
    <StudentShell 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      hasNewUpdate={hasNewUpdate}
      handleDismissUpdate={handleDismissUpdate}
    >
      {activeTab === "dashboard" && <DashboardView />}
      {activeTab === "forms" && <StudentFormsList />}
      {activeTab === "drive" && <SharedDriveView />}
      {activeTab === "settings" && <SettingsView />}
      {activeTab === "subgroup" && <SubgroupView />}
    </StudentShell>
  );
}

// NAVIGATION SHELL WITH PROPS PASSED FROM THE PARENT
function StudentShell({ 
  children, 
  activeTab, 
  setActiveTab, 
  hasNewUpdate, 
  handleDismissUpdate 
}) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  const currentStudent = localStorage.getItem("currentUser") || "Student";

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    setIsSidebarOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("userRole");
    navigate("/");
  };

  return (
    <div className="admin-container fade-in">
      {hasNewUpdate && <UpdateModal onClose={handleDismissUpdate} />}
      <MessagingDrawer />
      <div
        className={`mobileSidebarOverlay ${isSidebarOpen ? "active" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <FontAwesomeIcon icon={faX} id="closeBTN" />
      </div>

      <div className={`mobileSidebar ${isSidebarOpen ? "active" : ""}`}>
        {studentTabs.map((tab) => (
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
        <img
          src="./pwa-512x512.png"
          id="imageLogo"
          height={60}
          alt="935 scouting logo"
        />
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
            <h2>Hello, {currentStudent}</h2>
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
        {studentTabs.map((tab) => (
          <button
            key={tab.id}
            className={`admin-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => selectTab(tab.id)}
          >
            <FontAwesomeIcon icon={tab.icon} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-content-viewport">{children}</div>
    </div>
  );
}

// VIEW: DASHBOARD
function DashboardView() {
  return (
    <section>
      <h1>Dashboard</h1>
      <div className="dash-forms-panel">
        <div className="dash-forms-panel-header">
          <h3>My Dashboard</h3>
          <span className="admin-regionals-count">A Quick Look</span>
        </div>

        <div
          className="dash-forms-list"
          style={{ padding: "1.5rem", display: "flex", gap: "1rem" }}
        >
          <TasksPanel />
        </div>
      </div>
    </section>
  );
}

// VIEW: DRIVE
function LegacyDriveView() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [isUploaded, setIsUploaded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const openUploadMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  useEffect(() => {
    loadDrive(currentPath);
  }, []);

  const loadDrive = async (targetPath = "") => {
    try {
      const res = await fetch(
        `${apiBaseUrl}/drive?path=` + encodeURIComponent(targetPath),
      );

      if (!res.ok) {
        throw new Error("Access denied");
      }

      const data = await res.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (err) {
      console.error(err);

      // Fetch the root directory so the UI doesn't break/stay blank
      try {
        const rootRes = await fetch(`${apiBaseUrl}/drive?path=`);
        if (rootRes.ok) {
          const rootData = await rootRes.json();
          setFolders(rootData.folders || []);
          setFiles(rootData.files || []);
        }
      } catch (e) {
        setFolders([]);
        setFiles([]);
      }
    }
  };

  // Add 'file' as an optional parameter
  const upload = async (file = null) => {
    // Use the passed file if available, otherwise fall back to state
    const fileToUpload = file || selectedFile;

    if (!fileToUpload) {
      alert("Select a file first.");
      return;
    }

    const formData = new FormData();
    // Use fileToUpload here instead of selectedFile
    formData.append("file", fileToUpload);

    try {
      const res = await fetch(
        `${apiBaseUrl}/upload?path=` + encodeURIComponent(currentPath),
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await res.json();
      console.log(data);

      loadDrive(currentPath);
      alert("Upload successful!");
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    }
  };

  const handleBack = () => {
    if (!currentPath) return; // Already at the root folder

    const pathParts = currentPath.split("/");
    pathParts.pop(); // Remove the last folder name
    const previousPath = pathParts.join("/");

    setCurrentPath(previousPath);
    loadDrive(previousPath); // Refresh the view for the parent folder
  };

  function getDirectory(folderName) {
    setCurrentPath((prevPath) => {
      // Calculate the next path using the absolute freshest state guaranteed by React
      const nextPath = prevPath ? `${prevPath}/${folderName}` : folderName;

      // Pass this exact string directly to the drive loader
      loadDrive(nextPath);

      // Speculatively update the UI path
      return nextPath;
    });
  }

  const createFolder = async () => {
    const name = prompt("Folder name");
    if (!name) return;

    try {
      await fetch(`${apiBaseUrl}/folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      loadDrive(currentPath);
      alert("Folder created");
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return; // Exit if the user cancels the picker

    // Update your state
    setSelectedFile(file);

    // Trigger your separate function immediately
    upload(file);
  };

  return (
    <section>
      <h1>Drive</h1>
      <p style={{ padding: "0 1rem", color: "var(--text-muted)" }}>
        Access your shared files and scouting documents.
      </p>
      <div id="drive-content-all">
        {currentPath && (
          <button onClick={handleBack} id="drive-back-btn">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
        )}

        <button onClick={openUploadMenu} id="drive-upload-btn">
          <FontAwesomeIcon icon={isMenuOpen ? faX : faPlus} />
        </button>

        {isMenuOpen && (
          <div id="drive-upload-div">
            <>
              <label htmlFor="file-upload" className="custom-file-upload">
                + Upload
              </label>
              <input id="file-upload" type="file" onChange={handleFileChange} />
            </>
            <button onClick={createFolder} className="custom-file-upload">
              New Folder
            </button>
          </div>
        )}

        {folders.map((folder) => (
          <div
            key={folder}
            onClick={() => getDirectory(folder)}
            style={{ cursor: "pointer" }}
            className="drive-content folder"
          >
            <div className="drive-content-logo">
              <FontAwesomeIcon icon={faFolder} />
            </div>
            <div className="drive-content-text">{folder}</div>
          </div>
        ))}

        {files.map((file) => (
          <div key={file} className="drive-content file">
            <div className="drive-content-logo">
              <FontAwesomeIcon icon={faFile} />
            </div>
            <div className="drive-content-text">{file}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// VIEW: SETTINGS
function SettingsView() {
  const phoneNumber = "+13162493376";
  return (
    <section style={{ padding: "1rem" }}>
      <h1>Settings</h1>
      <div className="form-title-card" style={{ marginTop: "1rem" }}>
        <p>Settings Functionality coming soon.</p>
        <p>Current Version: {appInfo.version}</p>
        <p>Please email or text us about any bugs or feature requests</p>
        <a href="mailto:team935scouting@gmail.com">{appInfo.email}</a>
      </div>
    </section>
  );
}

// VIEW: SUBGROUP
function SubgroupView() {
  return (
    <section style={{ padding: "1rem" }}>
      <h1>My Subgroup</h1>
      <div className="form-title-card" style={{ marginTop: "1rem" }}>
        <p>Subgroup Functionality coming soon.</p>
      </div>
    </section>
  );
}

// FORMS LIST VIEW
function StudentFormsList() {
  const [forms, setForms] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadForms() {
      try {
        const role = localStorage.getItem("userRole") || "students";
        const subgroup = localStorage.getItem("userSubgroup") || "";
        const res = await fetch(
          `${useURL()}/forms/sent?role=${encodeURIComponent(role)}&subgroup=${encodeURIComponent(subgroup)}`,
          {
            headers: defaultHeaders(),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load forms");

        const submittedForms = JSON.parse(
          localStorage.getItem("submittedForms") || "[]",
        );
        const openForms = data.filter(
          (form) => !submittedForms.includes(form.id),
        );

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
    <section>
      <div className="forms-toolbar">
        <h1>Forms</h1>
      </div>

      {error && <p className="text-muted">{error}</p>}

      {status === "loading" ? (
        <div className="form-empty-state">
          <FontAwesomeIcon icon={faClipboardList} />
          <p>Loading forms...</p>
        </div>
      ) : forms.length === 0 ? (
        <div className="form-empty-state">
          <FontAwesomeIcon icon={faClipboardList} />
          <p>No forms are open right now.</p>
        </div>
      ) : (
        <div className="admin-forms-grid">
          {forms.map((form) => (
            <div key={form.id} className="admin-form-card">
              <div className="admin-form-card-header">
                <span className="admin-form-card-title">
                  {form.title || "Untitled form"}
                </span>
                <span className="admin-status-pill active">Open</span>
              </div>
              <div className="admin-card-body">
                {form.description && <p>{form.description}</p>}
                <p className="admin-form-card-meta">
                  {form.questions.length} question
                  {form.questions.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="admin-form-card-actions">
                <Link
                  to={`/form/${form.id}`}
                  style={{ textDecoration: "none", width: "100%" }}
                >
                  <button style={{ width: "100%", justifyContent: "center" }}>
                    <FontAwesomeIcon icon={faEye} /> View & Fill Form
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// FORM SUBMISSION VIEW
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
    const current = Array.isArray(answers[question.id])
      ? answers[question.id]
      : [];
    updateAnswer(
      question,
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option],
    );
  };

  const submit = async () => {
    setError("");
    const missing = (form.questions || []).find((question) => {
      if (!question.required) return false;
      const answer = answers[question.id];
      return Array.isArray(answer)
        ? answer.length === 0
        : !String(answer || "").trim();
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

      const submitted = JSON.parse(
        localStorage.getItem("submittedForms") || "[]",
      );
      if (!submitted.includes(form.id)) {
        submitted.push(form.id);
        localStorage.setItem("submittedForms", JSON.stringify(submitted));
      }

      setStatus("submitted");
      const role = String(
        localStorage.getItem("userRole") || "students",
      ).toLowerCase();
      navigate(
        role === "helper"
          ? "/helper"
          : role === "mentor"
            ? "/mentor"
            : role === "coach"
              ? "/coach"
              : "/student",
      );
    } catch (err) {
      setError(err.message);
    }
  };

  return (
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
                  onChange={(event) =>
                    updateAnswer(question, event.target.value)
                  }
                />
              )}

              {question.type === "dropdown" && (
                <select
                  className="form-type-select student-answer-select"
                  value={answers[question.id] || ""}
                  onChange={(event) =>
                    updateAnswer(question, event.target.value)
                  }
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
  );
}
