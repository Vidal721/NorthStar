import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faTrash, 
  faRightFromBracket, 
  faDatabase, 
  faExclamationTriangle,
  faTrophy,
  faUsers,
  faCircleCheck,
  faUser,
  faShieldHalved,
  faFilter
} from "@fortawesome/free-solid-svg-icons"; 

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("matches"); 
  const [localUrl, setLocalUrl] = useState("http://localhost:3000");
  
  // Data State Arrays
  const [matches, setMatches] = useState([]);
  const [pits, setPits] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [selectedRegional, setSelectedRegional] = useState("");
  const [users, setUsers] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentScout = localStorage.getItem("currentUser") || "Unknown Admin";

  useEffect(() => {
    fetchRegionalsList();
  }, [localUrl]);

  useEffect(() => {
    fetchAllSystemData({ showFullScreenLoader: true });
  }, [localUrl, selectedRegional]); 

  async function fetchRegionalsList() {
    try {
      const res = await fetch(`${localUrl}/api/regionals`, {
        headers: { "ngrok-skip-browser-warning": "69420" }
      });
      if (res.ok) {
        const json = await res.json();
        setRegionals(json);
      }
    } catch (err) {
      console.error("Could not fetch regionals listing:", err);
    }
  }

  async function fetchAllSystemData(options = { showFullScreenLoader: false }) {
    try {
      if (options.showFullScreenLoader) setIsLoading(true);
      const authIdentity = localStorage.getItem("currentUser") || "";
      const headersConfig = {
        "ngrok-skip-browser-warning": "69420",
        "Authorization": `Bearer ${authIdentity}` 
      };

      // Query data filtered by active selector
      let url = `${localUrl}/admin/data`;
      if (selectedRegional) url += `?regional_id=${selectedRegional}`;

      const dataRes = await fetch(url, { headers: headersConfig });
      if (!dataRes.ok) throw new Error("Failed to fetch analytical metrics from core grid.");
      const dataJson = await dataRes.ok && await dataRes.json();
      
      setMatches(dataJson.matches || []);
      setPits(dataJson.pits || []);

      // Pull active users tracking table safely
      const usersRes = await fetch(`${localUrl}/users`, { headers: headersConfig });
      if (usersRes.ok) {
        const usersJson = await usersRes.json();
        setUsers(usersJson);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteItem(type, id) {
    if (!window.confirm(`Are you sure you want to remove this ${type} record?`)) return;
    try {
      const authIdentity = localStorage.getItem("currentUser") || "";
      const response = await fetch(`${localUrl}/delete/${type}/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authIdentity}` }
      });
      if (response.ok) {
        fetchAllSystemData({ showFullScreenLoader: false });
      } else {
        throw new Error("Failed to delete entry asset.");
      }
    } catch (err) {
      alert(err.message);
    }
  }

  const deleteAll = async () => {
    if (!window.confirm("🚨 CRITICAL WARNING: This completely purges ALL match telemetry data and pit analytics permanently. Proceed?")) return;
    try {
      const response = await fetch(`${localUrl}/admin/wipe-all`, { method: "DELETE" });
      if (response.ok) {
        alert("System databases purged safely.");
        fetchAllSystemData({ showFullScreenLoader: false });
      } else {
        throw new Error("Purge transaction declined by service node.");
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser"); 
    navigate("/"); 
  };

  if (isLoading) return (
    <div className="flex-center column" style={{ height: "100vh", gap: "16px", background: "var(--bg-app)" }}>
      <FontAwesomeIcon icon={faDatabase} style={{ color: "var(--btn-accent-bg)", fontSize: "2rem" }} className="fade-in" />
      <span className="scout-overline">Loading Telemetry Core...</span>
    </div>
  );

  if (error) return (
    <div className="flex-center column" style={{ height: "100vh", gap: "16px", background: "var(--bg-app)" }}>
      <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: "var(--scout-red)", fontSize: "2rem" }} />
      <h3 style={{ color: "var(--scout-red)" }}>System Connection Timeout</h3>
      <p className="text-muted text-center" style={{ maxWidth: "400px", padding: "0 20px" }}>{error}</p>
      <button onClick={() => fetchAllSystemData({ showFullScreenLoader: true })} className="scout-btn-ghost" style={{ marginTop: "10px" }}>
        Retry Interface Link
      </button>
    </div>
  );

  return (
    <div className="admin-container fade-in">
      {/* Control Top Bar */}
      <header className="admin-header">
        <div className="flex column">
          <span className="scout-overline">HQ Administration Control Node</span>
          <h2>Scouter Analytics Panel</h2>
        </div>
        <div className="admin-profile-badge">
          <FontAwesomeIcon icon={faUser} />
          <span>{currentScout}</span>
          <button onClick={handleLogout} className="admin-logout-btn" title="Terminate Session">
            <FontAwesomeIcon icon={faRightFromBracket} />
          </button>
        </div>
      </header>

      {/* Control Row Elements */}
      <div className="admin-controls-card">
        <div className="admin-filter-group">
          <FontAwesomeIcon icon={faFilter} className="text-muted" />
          <select 
            value={selectedRegional} 
            onChange={(e) => setSelectedRegional(e.target.value)}
            className="admin-select-input"
          >
            <option value="">🌐 View All Registered Regionals</option>
            {regionals.map((r) => (
              <option key={r.id} value={r.id}>{r.year} - {r.name}</option>
            ))}
          </select>
        </div>

        <div className="admin-tab-row">
          <button className={`admin-tab-btn ${activeTab === "matches" ? "active" : ""}`} onClick={() => setActiveTab("matches")}>
            Match Entries ({matches.length})
          </button>
          <button className={`admin-tab-btn ${activeTab === "pits" ? "active" : ""}`} onClick={() => setActiveTab("pits")}>
            Pit Profiles ({pits.length})
          </button>
          <button className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
            Operator Indexes ({users.length})
          </button>
        </div>

        <button onClick={deleteAll} className="admin-btn-danger-wipe">
          Purge Cache System
        </button>
      </div>

      {/* Dynamic Data Content Area */}
      <div className="admin-content-viewport">
        {activeTab === "matches" && (
          <div className="admin-grid-layout">
            {matches.length === 0 ? (
              <p className="text-muted text-center p-md">No telemetry records indexed under this scope.</p>
            ) : (
              matches.map((item) => (
                <div key={item.id} className="admin-data-card">
                  <div className="admin-card-header">
                    <div>
                      <span className="admin-badge-team">Team {item.team_number}</span>
                      <span className="admin-badge-match">Match {item.match_number}</span>
                    </div>
                    <button onClick={() => deleteItem("match", item.id)} className="admin-row-delete-btn">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                  <div className="admin-card-body">
                    <p><strong>Regional Context:</strong> {item.regional_name}</p>
                    <p><strong>Captured By:</strong> {item.scout_name || "Anonymous Node"}</p>
                    <div className="admin-payload-dump">
                      {Object.entries(item.payload).map(([k, v]) => (
                        <div key={k} className="payload-row">
                          <span className="key">{k}:</span> <span className="val">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "pits" && (
          <div className="admin-grid-layout">
            {pits.length === 0 ? (
              <p className="text-muted text-center p-md">No specific layout definitions saved.</p>
            ) : (
              pits.map((item) => (
                <div key={item.id} className="admin-data-card">
                  <div className="admin-card-header">
                    <div>
                      <span className="admin-badge-team accent">Form ID: {item.form_id || "Global"}</span>
                    </div>
                    <button onClick={() => deleteItem("pit", item.id)} className="admin-row-delete-btn">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                  <div className="admin-card-body">
                    <p><strong>Regional Mapping:</strong> {item.regional_name}</p>
                    <div className="admin-payload-dump">
                      {Object.entries(item.payload).map(([k, v]) => (
                        <div key={k} className="payload-row">
                          <span className="key">{k}:</span> <span className="val">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div className="admin-users-list">
            {users.length === 0 ? (
              <p className="text-muted text-center p-md">No operators logged in current user matrix.</p>
            ) : (
              users.map((account, index) => {
                const isSelf = account.username === currentScout;
                return (
                  <div key={index} className="admin-user-row">
                    <div className="flex items-center gap-md">
                      <div className="admin-avatar-icon">
                        <FontAwesomeIcon icon={faUser} />
                      </div>
                      <div className="flex column">
                        <span style={{ fontWeight: "700" }}>{account.username}</span>
                        <span className="text-muted" style={{ fontSize: "11px", fontFamily: "monospace" }}>
                          Token: {account.passwordHash ? account.passwordHash.substring(0, 15) + "..." : "No Security Hash Set"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-sm">
                      {isSelf && (
                        <span className="admin-status-pill active">
                          <FontAwesomeIcon icon={faCircleCheck} /> ACTIVE CONSOLE
                        </span>
                      )}
                      <span className="admin-status-pill">
                        <FontAwesomeIcon icon={faShieldHalved} /> {account.role || "Operator"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}