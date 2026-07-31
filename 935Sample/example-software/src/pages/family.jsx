import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faClipboardList,
  faRightFromBracket,
  faUserGraduate,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";
import { authHeader } from "../auth";
import MessagingDrawer from "../componets/MessagingDrawer";
import AnnouncementBell from "../componets/AnnouncementBell";
import FeedbackButton from "../componets/FeedbackButton";

const defaultHeaders = (extra = {}) => ({
  "ngrok-skip-browser-warning": "69420",
  ...authHeader(),
  ...extra,
});

export default function FamilyPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState({
    parent: null,
    students: [],
    events: [],
    forms: [],
  });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch(`${useURL()}/parent/dashboard`, {
          headers: defaultHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load dashboard");
        setDashboard(data);
        setStatus("ready");
      } catch (err) {
        setError(err.message);
        setStatus("error");
      }
    }

    loadDashboard();
  }, []);

  const logout = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("userRole");
    navigate("/");
  };

  const parentName = dashboard.parent
    ? `${dashboard.parent.firstName || ""} ${dashboard.parent.lastName || ""}`.trim()
    : localStorage.getItem("currentUser") || "Parent";

  return (
    <div className="admin-container fade-in">
      <MessagingDrawer />
      <header className="admin-header">
        <img src="./pwa-512x512.png" id="imageLogo" height={60} alt="935 scouting logo" />
        <AnnouncementBell />
        <FeedbackButton />
        <button className="admin-logout-btn" onClick={logout}>
          <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
        </button>
      </header>

      <div className="admin-content-viewport">
        <section>
          <div className="forms-toolbar">
            <h1>Parent Dashboard</h1>
            <span className="admin-regionals-count">{parentName}</span>
          </div>

          {status === "loading" && (
            <div className="form-empty-state">
              <FontAwesomeIcon icon={faUsers} />
              <p>Loading parent dashboard...</p>
            </div>
          )}

          {status === "error" && (
            <div className="form-empty-state">
              <FontAwesomeIcon icon={faUsers} />
              <p>{error}</p>
            </div>
          )}

          {status === "ready" && (
            <div className="parent-dashboard-grid">
              <DashboardPanel
                title="My Students"
                count={dashboard.students.length}
                icon={faUserGraduate}
              >
                {dashboard.students.length === 0 ? (
                  <p className="text-muted">
                    No student has approved your connection yet. They will see
                    the request in Messages.
                  </p>
                ) : (
                  dashboard.students.map((student) => (
                    <div className="parent-list-row" key={student.username}>
                      <div>
                        <strong>
                          {student.firstName} {student.lastName}
                        </strong>
                        <p>{student.subgroup || "No subgroup"}</p>
                        <p>
                          {(student.assignedForms || []).length} open form
                          {(student.assignedForms || []).length === 1
                            ? ""
                            : "s"}
                        </p>
                      </div>
                      <span className="admin-status-pill active">Approved</span>
                    </div>
                  ))
                )}
              </DashboardPanel>

              <DashboardPanel
                title="Upcoming Events"
                count={dashboard.events.length}
                icon={faCalendarDays}
              >
                {dashboard.events.length === 0 ? (
                  <p className="text-muted">No upcoming events have been added.</p>
                ) : (
                  dashboard.events.map((event) => (
                    <div className="parent-list-row" key={event.id}>
                      <div>
                        <strong>{event.title}</strong>
                        <p>
                          {new Date(event.starts_at).toLocaleString()}
                          {event.location ? ` · ${event.location}` : ""}
                        </p>
                        {event.notes && <p>{event.notes}</p>}
                      </div>
                    </div>
                  ))
                )}
              </DashboardPanel>

              <DashboardPanel
                title="Parent Forms"
                count={dashboard.forms.length}
                icon={faClipboardList}
              >
                {dashboard.forms.length === 0 ? (
                  <p className="text-muted">No parent forms are waiting.</p>
                ) : (
                  dashboard.forms.map((form) => (
                    <div className="parent-list-row" key={form.id}>
                      <div>
                        <strong>{form.title || "Untitled form"}</strong>
                        {form.description && <p>{form.description}</p>}
                      </div>
                      <Link className="parent-form-link" to={`/form/${form.id}`}>
                        Fill
                      </Link>
                    </div>
                  ))
                )}
              </DashboardPanel>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DashboardPanel({ title, count, icon, children }) {
  return (
    <div className="dash-forms-panel parent-panel">
      <div className="dash-forms-panel-header">
        <h3>
          <FontAwesomeIcon icon={icon} /> {title}
        </h3>
        <span className="admin-regionals-count">{count}</span>
      </div>
      <div className="dash-forms-list">{children}</div>
    </div>
  );
}
