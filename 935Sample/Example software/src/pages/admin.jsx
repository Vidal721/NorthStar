import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom"; 
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faTrash, 
  faRightFromBracket, 
  faNetworkWired, 
  faDatabase, 
  faExclamationTriangle,
  faSliders,
  faTrophy,
  faUsers,
  faUserShield,
  faCircleCheck,
  faTowerBroadcast,
  faUser,
  faShieldHalved
} from "@fortawesome/free-solid-svg-icons"; 

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  // Tab Management State
  const [activeTab, setActiveTab] = useState("dashboard"); 
  
  const [localUrl, setLocalUrl] = useState("https://taco-childhood-jailbreak.ngrok-free.dev");
  const [data, setData] = useState([]);
  const [users, setUsers] = useState([]); // Dynamic system users state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentScout = localStorage.getItem("currentUser") || "Unknown Admin";

  useEffect(() => {
    fetchAllSystemData({ showFullScreenLoader: true });
  }, [localUrl]); 

  // Combined fetch handler to pull database entries and backend user directory
  async function fetchAllSystemData(options = { showFullScreenLoader: false }) {
    try {
      if (options.showFullScreenLoader) {
        setIsLoading(true);
      }
      const authIdentity = localStorage.getItem("currentUser") || "";
      const headersConfig = {
        "ngrok-skip-browser-warning": "69420",
        "Authorization": `Bearer ${authIdentity}` 
      };

      // 1. Fetch Match Telemetry Records
      const matchRes = await fetch(`${localUrl}/match/data`, { headers: headersConfig });
      if (!matchRes.ok) throw new Error("Failed to fetch match metrics from telemetry grid.");
      const matchJson = await matchRes.json();
      setData(matchJson);

      // 2. Fetch User Profiles Directory from index.js backend
      const usersRes = await fetch(`${localUrl}/users`, { headers: headersConfig });
      if (usersRes.ok) {
        const usersJson = await usersRes.json();
        setUsers(usersJson);
      } else {
        console.warn("Could not retrieve users list from /users gateway.");
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteItem(id) {
    try {
      const authIdentity = localStorage.getItem("currentUser") || "";
      const response = await fetch(`${localUrl}/delete/match/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${authIdentity}` 
        }
      });
      if (response.ok) {
        fetchAllSystemData({ showFullScreenLoader: false });
      } else {
        throw new Error("Failed to delete item from server.");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const deleteAll = async () => {
    if (!window.confirm("ARE YOU SURE?? This deletes EVERYTHING")) return;
    alert("Delete all not implemented on server yet.");
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser"); 
    navigate("/"); 
  };

  // UI styling generator for Tab Buttons matching scout.jsx tokens
  const tabBtnStyle = (tabId) => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "var(--radius-md)",
    border: "1px solid " + (activeTab === tabId ? "var(--border-default)" : "transparent"),
    background: activeTab === tabId ? "var(--bg-elevated)" : "transparent",
    color: activeTab === tabId ? "var(--text-primary)" : "var(--text-muted)",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "12px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    transition: "all var(--transition-fast)"
  });

  if (isLoading)
    return (
      <div className="flex-center column" style={{ height: "100vh", gap: "16px", background: "var(--bg-app)" }}>
        <FontAwesomeIcon icon={faDatabase} style={{ color: "var(--btn-accent-bg)", fontSize: "2rem" }} className="fade-in" />
        <span className="scout-overline">Loading System Core...</span>
      </div>
    );

  if (error)
    return (
      <div className="flex-center column" style={{ height: "100vh", gap: "16px", background: "var(--bg-app)" }}>
        <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: "var(--scout-red)", fontSize: "2rem" }} />
        <h3 style={{ color: "var(--scout-red)" }}>System Error</h3>
        <p className="text-muted text-center" style={{ maxWidth: "400px", padding: "0 20px" }}>{error}</p>
        <button onClick={() => fetchAllSystemData({ showFullScreenLoader: true })} className="scout-btn-ghost" style={{ marginTop: "10px" }}>
          Retry Connection
        </button>
      </div>
    );

  return (
    <div className="page-content fade-in" style={{ padding: "24px", minHeight: "100vh", background: "var(--bg-app)" }}>
      
      {/* HEADER BAR */}
      <div className="flex-between" style={{ borderBottom: "1px solid var(--border-default)", paddingBottom: "16px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>ADMIN PORTAL</h1>
          <span className="scout-overline" style={{ color: "var(--scout-indigo-soft)" }}>
            Authorized Operator: {currentScout}
          </span>
        </div>
        
        <button onClick={handleLogout} className="scout-btn-danger" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FontAwesomeIcon icon={faRightFromBracket} />
          Logout
        </button>
      </div>

      {/* TABS NAVIGATION PANEL */}
      <div className="scout-card" style={{ padding: "6px", display: "flex", gap: "6px", marginBottom: "24px", background: "var(--bg-surface)", overflowX: "auto" }}>
        <button onClick={() => setActiveTab("dashboard")} style={tabBtnStyle("dashboard")}>
          <FontAwesomeIcon icon={faSliders} /> Dashboard
        </button>
        <button onClick={() => setActiveTab("data")} style={tabBtnStyle("data")}>
          <FontAwesomeIcon icon={faDatabase} /> Data ({data.length})
        </button>
        <button onClick={() => setActiveTab("competition")} style={tabBtnStyle("competition")}>
          <FontAwesomeIcon icon={faTrophy} /> Competition
        </button>
        <button onClick={() => setActiveTab("users")} style={tabBtnStyle("users")}>
          <FontAwesomeIcon icon={faUsers} /> Current Users ({users.length || 1})
        </button>
      </div>

      {/* ==================== TAB CONTENT: DASHBOARD ==================== */}
      {activeTab === "dashboard" && (
        <div className="fade-in flex column gap-lg">
          <div className="scout-card scout-card--alt flex-between" style={{ flexWrap: "wrap", gap: "16px" }}>
            <div className="flex-center gap-md">
              <div className="divIcon" style={{ position: "static", borderRadius: "var(--radius-md)", height: "40px", width: "40px", color: "var(--btn-accent-text)", background: "var(--btn-accent-bg)" }}>
                <FontAwesomeIcon icon={faNetworkWired} />
              </div>
              <div className="flex column">
                <span className="scout-overline">Network Environment</span>
                <label className="flex-center gap-sm" style={{ cursor: "pointer", fontWeight: "600", fontSize: "14px", marginTop: "2px" }}>
                  <input 
                    type="checkbox" 
                    className="scout-input" 
                    style={{ width: "16px", height: "16px", margin: 0, accentColor: "var(--btn-accent-bg)" }}
                    checked={localUrl === "http://localhost:3000"} 
                    onChange={(e) => {
                      setLocalUrl(e.target.checked ? "http://localhost:3000" : "https://taco-childhood-jailbreak.ngrok-free.dev");
                    }} 
                  />
                  Competition Server?
                </label>
              </div>
            </div>

            <div className="flex column" style={{ minWidth: "250px" }}>
              <span className="scout-overline">Active Data Gateway Target</span>
              <code className="scout-input--formula" style={{ background: "var(--input-bg)", padding: "6px 12px", borderRadius: "var(--radius-md)", marginTop: "4px", border: "1px solid var(--border-subtle)" }}>
                {localUrl}
              </code>
            </div>
          </div>

          <div className="scout-stat-grid-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            <div className="scout-stat-tile scout-stat-tile--lg">
              <span className="scout-stat-label scout-stat-label--lg">Database Density</span>
              <span className="scout-stat-value scout-stat-value--lg" style={{ color: "var(--scout-indigo-soft)" }}>{data.length} Records</span>
            </div>
            <div className="scout-stat-tile scout-stat-tile--lg">
              <span className="scout-stat-label scout-stat-label--lg">Server Status</span>
              <span className="scout-stat-value scout-stat-value--lg" style={{ color: "var(--scout-green-soft)", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: "800", marginTop: "4px" }}>
                <FontAwesomeIcon icon={faTowerBroadcast} /> ONLINE
              </span>
            </div>
            <div className="scout-stat-tile scout-stat-tile--lg">
              <span className="scout-stat-label scout-stat-label--lg">Registered Scouts</span>
              <span className="scout-stat-value scout-stat-value--lg" style={{ color: "var(--btn-accent-bg)", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: "800", marginTop: "4px" }}>
                <FontAwesomeIcon icon={faUsers} /> {users.length || "1 Core"} Users
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB CONTENT: DATA ==================== */}
      {activeTab === "data" && (
        <div className="fade-in">
          <div className="flex-between" style={{ marginBottom: "12px", alignItems: "flex-end" }}>
            <span className="scout-overline">Telemetry Database Rows ({data.length})</span>
            <button onClick={deleteAll} className="scout-btn-danger" style={{ padding: "6px 12px", fontSize: "11px" }}>
              Purge Global Storage
            </button>
          </div>

          <div className="scout-card" style={{ padding: 0, overflowX: "auto", boxShadow: "var(--shadow-md)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-default)" }}>
                  <th style={{ padding: "14px 16px", color: "var(--text-secondary)" }} className="scout-overline">ID</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-secondary)" }} className="scout-overline">Team</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-secondary)" }} className="scout-overline">Match</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-secondary)" }} className="scout-overline">Scout</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-secondary)" }} className="scout-overline">Timestamp</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-secondary)", textAlign: "center" }} className="scout-overline">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-muted text-center" style={{ padding: "32px", fontSize: "14px" }}>
                      No match telemetry entries returned from gateway node.
                    </td>
                  </tr>
                ) : (
                  data.map((row, index) => {
                    const time = row.meta?.timestamp ? row.meta.timestamp.replace("T", " ").split(".")[0] : "???";
                    return (
                      <tr key={row.id} style={{ borderBottom: index === data.length - 1 ? "none" : "1px solid var(--border-subtle)", background: index % 2 === 0 ? "transparent" : "var(--bg-surface)" }}>
                        <td style={{ padding: "14px 16px", fontWeight: "600", fontFamily: "monospace" }}>{row.id}</td>
                        <td style={{ padding: "14px 16px" }}>
                          <span className="scout-role-badge--scoring" style={{ background: "var(--accent-yellow-soft)", color: "var(--text-primary)", borderColor: "var(--border-default)" }}>
                            #{row.meta?.teamNumber || "???"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: "700" }}>{row.meta?.matchNumber || "???"}</td>
                        <td style={{ padding: "14px 16px", color: "var(--text-secondary)" }}>{row.meta?.scoutName || "???"}</td>
                        <td style={{ padding: "14px 16px", color: "var(--text-muted)", fontFamily: "monospace" }}>{time}</td>
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <button onClick={() => deleteItem(row.id)} className="scout-btn-danger" style={{ padding: "8px 12px" }}>
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB CONTENT: COMPETITION ==================== */}
      {activeTab === "competition" && (
        <div className="fade-in flex column gap-md">
          <span className="scout-overline">Competition Engine Config</span>
          <div className="scout-card" style={{ background: "var(--bg-surface)" }}>
            <h3 style={{ margin: "0 0 8px 0" }}>Event Tracking Configuration</h3>
            <p className="text-muted" style={{ margin: "0 0 16px 0", fontSize: "13px" }}>
              Manage tournament status rules, schedule imports, and pipeline criteria parameters.
            </p>
            <div className="flex column gap-sm" style={{ maxWidth: "400px" }}>
              <label className="scout-overline" style={{ fontSize: "9px" }}>Active Event Name / Code</label>
              <input type="text" className="scout-input" defaultValue="2026_KSRG_Regional" placeholder="e.g. 2026_KSRG" style={{ background: "var(--bg-elevated)" }} />
              <button className="scout-btn-primary" style={{ marginTop: "8px", padding: "12px", width: "100%" }} onClick={() => alert("Settings updated locally")}>
                Save Active Competition Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB CONTENT: CURRENT USERS ==================== */}
      {activeTab === "users" && (
        <div className="fade-in flex column gap-md">
          <span className="scout-overline">System Accounts Registry ({users.length || 1})</span>
          
          <div className="flex column gap-sm">
            {users.length === 0 ? (
              /* Fallback view showcasing current user fallback info if server array is empty */
              <div className="scout-card flex-between" style={{ background: "var(--bg-surface)" }}>
                <div className="flex-center gap-md">
                  <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "var(--btn-accent-bg)", color: "var(--btn-primary-text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                    {currentScout.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex column">
                    <span style={{ fontWeight: "700", fontSize: "14px" }}>{currentScout}</span>
                    <span className="text-muted" style={{ fontSize: "11px" }}>Authorized Connected Session</span>
                  </div>
                </div>
                <span className="scout-role-badge--scoring" style={{ background: "var(--scout-green-bg)", color: "var(--scout-green-soft)", borderColor: "rgba(34, 197, 94, 0.2)" }}>
                  <FontAwesomeIcon icon={faCircleCheck} /> CURRENT ADMIN
                </span>
              </div>
            ) : (
              /* Map through all registered records pulled dynamically from users.json */
              users.map((account, index) => {
                const isSelf = account.username === currentScout;
                return (
                  <div key={index} className="scout-card flex-between" style={{ background: "var(--bg-surface)", borderLeft: isSelf ? "4px solid var(--btn-accent-bg)" : "1px solid var(--border-subtle)" }}>
                    <div className="flex-center gap-md">
                      <div style={{ 
                        width: "38px", 
                        height: "38px", 
                        borderRadius: "50%", 
                        background: isSelf ? "var(--btn-accent-bg)" : "var(--bg-elevated)", 
                        color: isSelf ? "var(--btn-primary-text)" : "var(--text-secondary)", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        fontWeight: "700",
                        border: "1px solid var(--border-subtle)"
                      }}>
                        <FontAwesomeIcon icon={faUser} style={{ fontSize: "12px" }} />
                      </div>
                      <div className="flex column">
                        <span style={{ fontWeight: "700", fontSize: "14px" }}>{account.username}</span>
                        <span className="text-muted" style={{ fontSize: "11px", fontFamily: "monospace" }}>
                          Encrypted Token Segment: {account.password ? account.password.substring(0, 10) + "..." : "No Hash Set"}
                        </span>
                      </div>
                    </div>

                    <div className="flex-center gap-sm">
                      {isSelf && (
                        <span className="scout-role-badge--scoring" style={{ background: "var(--scout-green-bg)", color: "var(--scout-green-soft)", borderColor: "rgba(34, 197, 94, 0.15)" }}>
                          <FontAwesomeIcon icon={faCircleCheck} /> ACTIVE SESSION
                        </span>
                      )}
                      <span className="scout-role-badge" style={{ textTransform: "uppercase", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <FontAwesomeIcon icon={faShieldHalved} /> Scout Operator
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}