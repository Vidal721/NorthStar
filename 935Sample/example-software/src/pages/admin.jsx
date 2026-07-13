import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  faFilter,
  faEye,
  faEyeSlash,
  faServer,
  faCloud,
  faRotateRight,
  faChartColumn,
  faBars,
  faX,
  faWrench,
  faShapes,
  faGear,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import DriveView from "../componets/DriveView";
import LeadershipManager from "../componets/LeadershipManager";
import MessagingDrawer from "../componets/MessagingDrawer";
import TasksPanel from "../componets/TasksPanel";
import {
  API_ENDPOINTS,
  getApiBaseUrl,
  getConnectionMode,
  getDefaultHeaders,
  setConnectionMode as saveConnectionMode,
} from "../apiConfig";
import { useURL } from "../urlConfig";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("matches");
  const [connectionMode, setConnectionModeState] =
    useState(getConnectionMode());

  const [matches, setMatches] = useState([]);
  const [pits, setPits] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [selectedRegional, setSelectedRegional] = useState("");
  const [users, setUsers] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentScout = localStorage.getItem("currentUser") || "Unknown Admin";
  const apiBaseUrl = useURL();

  useEffect(() => {
    fetchRegionalsList();
  }, [connectionMode]);

  useEffect(() => {
    fetchAllSystemData({ showFullScreenLoader: true });
  }, [connectionMode, selectedRegional]);

  useEffect(() => {
    const syncConnectionMode = () =>
      setConnectionModeState(getConnectionMode());
    window.addEventListener("storage", syncConnectionMode);
    window.addEventListener("connection-mode-change", syncConnectionMode);
    return () => {
      window.removeEventListener("storage", syncConnectionMode);
      window.removeEventListener("connection-mode-change", syncConnectionMode);
    };
  }, []);

  function handleConnectionModeChange(mode) {
    setConnectionModeState(saveConnectionMode(mode));
    setError(null);
  }

  async function fetchRegionalsList() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/regionals`, {
        headers: getDefaultHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setRegionals(json);
      }
    } catch (err) {
      console.error("Could not fetch regionals listing:", err);
    }
  }

  async function toggleRegionalVisibility(regional) {
    try {
      const authIdentity = localStorage.getItem("currentUser") || "";
      const response = await fetch(
        `${apiBaseUrl}/api/regionals/${regional.id}/visibility`,
        {
          method: "PATCH",
          headers: getDefaultHeaders({
            "Content-Type": "application/json",
            Authorization: `Bearer ${authIdentity}`,
          }),
          body: JSON.stringify({ visible: !regional.visible_in_vis }),
        },
      );

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(
          detail.error || "Failed to update regional visibility.",
        );
      }

      const updatedRegional = await response.json();
      setRegionals((prev) =>
        prev.map((item) =>
          item.id === updatedRegional.id ? updatedRegional : item,
        ),
      );
    } catch (err) {
      alert(err.message);
    }
  }

  async function fetchAllSystemData(options = { showFullScreenLoader: false }) {
    try {
      if (options.showFullScreenLoader) setIsLoading(true);
      const authIdentity = localStorage.getItem("currentUser") || "";
      const headersConfig = {
        ...getDefaultHeaders(),
        Authorization: `Bearer ${authIdentity}`,
      };

      let url = `${apiBaseUrl}/admin/data`;
      if (selectedRegional) url += `?regional_id=${selectedRegional}`;

      const dataRes = await fetch(url, { headers: headersConfig });
      if (!dataRes.ok)
        throw new Error("Failed to fetch analytical metrics from core grid.");
      const dataJson = (await dataRes.ok) && (await dataRes.json());

      setMatches(dataJson.matches || []);
      setPits(dataJson.pits || []);

      const usersRes = await fetch(`${apiBaseUrl}/users`, {
        headers: headersConfig,
      });
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
    if (!window.confirm(`Are you sure you want to remove this ${type} record?`))
      return;
    try {
      const authIdentity = localStorage.getItem("currentUser") || "";
      const response = await fetch(`${apiBaseUrl}/delete/${type}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authIdentity}` },
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

  const toggleMobileSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const deleteAll = async () => {
    if (
      !window.confirm(
        "圷 CRITICAL WARNING: This completely purges ALL match telemetry data and pit analytics permanently. Proceed?",
      )
    )
      return;
    try {
      const response = await fetch(`${apiBaseUrl}/admin/wipe-all`, {
        method: "DELETE",
      });
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

  const openLogout = () => {
    const signoutBtn = document.getElementById("logoutSection");
    if (signoutBtn.style.display === "block") {
      signoutBtn.style.display = "none";
    } else {
      signoutBtn.style.display = "block";
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const visibleRegionalCount = regionals.filter(
    (r) => !!r.visible_in_vis,
  ).length;
  const activeRegionalLabel =
    regionals.find(
      (regional) => String(regional.id) === String(selectedRegional),
    )?.name || "All Regionals";
  const summaryCards = [
    { label: "Match Data", value: matches.length, icon: faTrophy },
    { label: "Pit Data", value: pits.length, icon: faDatabase },
    { label: "Operators", value: users.length, icon: faUsers },
    {
      label: "Visible Events",
      value: `${visibleRegionalCount}/${regionals.length}`,
      icon: faChartColumn,
    },
  ];

  if (isLoading)
    return (
      <div
        className="flex-center column"
        style={{ height: "100vh", gap: "16px", background: "var(--bg-app)" }}
      >
        <FontAwesomeIcon
          icon={faDatabase}
          style={{ color: "var(--btn-accent-bg)", fontSize: "2rem" }}
          className="fade-in"
        />
        <span className="scout-overline">Loading Telemetry Core...</span>
      </div>
    );

  if (error)
    return (
      <div
        className="flex-center column"
        style={{ height: "100vh", gap: "16px", background: "var(--bg-app)" }}
      >
        <FontAwesomeIcon
          icon={faExclamationTriangle}
          style={{ color: "var(--scout-red)", fontSize: "2rem" }}
        />
        <h3 style={{ color: "var(--scout-red)" }}>System Connection Timeout</h3>
        <p
          className="text-muted text-center"
          style={{ maxWidth: "400px", padding: "0 20px" }}
        >
          {error}
        </p>
        <button
          onClick={() => fetchAllSystemData({ showFullScreenLoader: true })}
          className="scout-btn-ghost"
          style={{ marginTop: "10px" }}
        >
          Retry Interface Link
        </button>
      </div>
    );

  return (
    <div className="admin-container fade-in">
      <MessagingDrawer />
      <div
        className={`mobileSidebarOverlay ${isSidebarOpen ? "active" : ""}`}
        onClick={toggleMobileSidebar}
      >
        <FontAwesomeIcon
          icon={faX}
          id="closeBTN"
          onClick={toggleMobileSidebar}
        />
      </div>

      <div className={`mobileSidebar ${isSidebarOpen ? "active" : ""}`}>
        <button
          className={`admin-tab-btn-mobile ${activeTab === "matches" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("matches");
            toggleMobileSidebar();
          }}
        >
          <FontAwesomeIcon icon={faDatabase} /> Match Data ({matches.length})
        </button>
        <button
          className={`admin-tab-btn-mobile ${activeTab === "pits" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("pits");
            toggleMobileSidebar();
          }}
        >
          <FontAwesomeIcon icon={faDatabase} /> Pit Data ({pits.length})
        </button>
        <button
          className={`admin-tab-btn-mobile ${activeTab === "users" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("users");
            toggleMobileSidebar();
          }}
        >
          <FontAwesomeIcon icon={faUser} /> Users ({users.length})
        </button>
        <button
          className={`admin-tab-btn-mobile ${activeTab === "leaders" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("leaders");
            toggleMobileSidebar();
          }}
        >
          <FontAwesomeIcon icon={faUsers} /> Subgroup Leaders
        </button>
        <button
          className={`admin-tab-btn-mobile ${activeTab === "drive" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("drive");
            toggleMobileSidebar();
          }}
        >
          <FontAwesomeIcon icon={faFolderOpen} /> Drive
        </button>
        <button
          className={`admin-tab-btn-mobile ${activeTab === "visibility" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("visibility");
            toggleMobileSidebar();
          }}
        >
          <FontAwesomeIcon icon={faWrench} /> Manage Regionals (
          {visibleRegionalCount}/{regionals.length})
        </button>
        <button
          className={`admin-tab-btn-mobile ${activeTab === "visibility" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("apps");
            toggleMobileSidebar();
          }}
        >
          <FontAwesomeIcon icon={faShapes} /> Apps
        </button>
        <Link
          to="/scoutSeettings"
          rel="noopener noreferrer"
          className="admin-tab-btn-mobile"
        >
          <FontAwesomeIcon icon={faGear} /> Settings
        </Link>
      </div>

      <header className="admin-header">
        <img src="./pwa-512x512.png" id="imageLogo" height={60} alt="" />
        <FontAwesomeIcon
          icon={faBars}
          id="mobileLogo"
          onClick={toggleMobileSidebar}
        />
        <div className="admin-profile-badge" onClick={openLogout}>
          <FontAwesomeIcon id="mobileUser" icon={faUser} />
        </div>
        <div id="logoutSection">
          <h2>Hello, {currentScout}</h2>
          <button
            onClick={handleLogout}
            className="admin-logout-btn"
            id="adminLogout"
            title="Terminate Session"
          >
            <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
          </button>
        </div>
      </header>

      <div className="admin-tab-row">
        <button
          className={`admin-tab-btn ${activeTab === "matches" ? "active" : ""}`}
          onClick={() => setActiveTab("matches")}
        >
          Match data ({matches.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "pits" ? "active" : ""}`}
          onClick={() => setActiveTab("pits")}
        >
          Pit Data ({pits.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Users ({users.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "leaders" ? "active" : ""}`}
          onClick={() => setActiveTab("leaders")}
        >
          Subgroup Leaders
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "drive" ? "active" : ""}`}
          onClick={() => setActiveTab("drive")}
        >
          Drive
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "visibility" ? "active" : ""}`}
          onClick={() => setActiveTab("visibility")}
        >
          Manage Visibility ({visibleRegionalCount}/{regionals.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "apps" ? "active" : ""}`}
          onClick={() => setActiveTab("apps")}
        >
          Apps
        </button>
      </div>

      <div className="admin-content-viewport">
        <TasksPanel />
        {activeTab === "drive" && <DriveView />}
        {activeTab === "leaders" && <LeadershipManager />}
        {activeTab === "matches" && (
          <div className="admin-grid-layout">
            <div className="admin-controls-card">
              <div className="admin-filter-group">
                <FontAwesomeIcon icon={faFilter} className="text-muted" />
                <select
                  value={selectedRegional}
                  onChange={(e) => setSelectedRegional(e.target.value)}
                  className="admin-select-input"
                >
                  <option value="">View All Regionals</option>
                  {regionals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.year} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <button onClick={deleteAll} className="admin-btn-danger-wipe">
                Delete all data
              </button>
            </div>
            {matches.length === 0 ? (
              <p className="text-muted text-center p-md">
                No match data submited yet,{" "}
                <Link to={"/match"}>submit some now</Link>
              </p>
            ) : (
              matches.map((item) => (
                <div key={item.id} className="admin-data-card">
                  <div className="admin-card-header">
                    <div>
                      <span className="admin-badge-team">
                        Team {item.team_number}
                      </span>
                      <span className="admin-badge-match">
                        Match {item.match_number}
                      </span>
                      <span className="admin-badge-match">
                        Regional {item.regional_name}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteItem("match", item.id)}
                      className="admin-row-delete-btn"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                  <div className="admin-card-body">
                    <div className="admin-payload-dump">
                      {Object.entries(item.payload).map(([k, v]) => (
                        <div key={k} className="payload-row">
                          <span className="key">{k}:</span>{" "}
                          <span className="val">
                            {typeof v === "object" && v !== null ? (
                              <div
                                className="nested-payload"
                                style={{ paddingLeft: "15px" }}
                              >
                                {Object.entries(v).map(([nestedK, nestedV]) => (
                                  <div key={nestedK} className="nested-row">
                                    <span className="nested-key">
                                      {nestedK}:
                                    </span>{" "}
                                    <span className="nested-val">
                                      {String(nestedV)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              String(v)
                            )}
                          </span>
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
            <div className="admin-controls-card">
              <div className="admin-filter-group">
                <FontAwesomeIcon icon={faFilter} className="text-muted" />
                <select
                  value={selectedRegional}
                  onChange={(e) => setSelectedRegional(e.target.value)}
                  className="admin-select-input"
                >
                  <option value="">View All Regionals</option>
                  {regionals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.year} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <button onClick={deleteAll} className="admin-btn-danger-wipe">
                Delete all data
              </button>
            </div>
            {pits.length === 0 ? (
              <p className="text-muted text-center p-md">
                No Pit data has been submitted yet,{" "}
                <Link to={"/pit"}>submit some now</Link>
              </p>
            ) : (
              pits.map((item) => (
                <div key={item.id} className="admin-data-card">
                  <div className="admin-card-header">
                    <div>
                      <span className="admin-badge-team accent">Pit Data</span>
                    </div>
                    <button
                      onClick={() => deleteItem("pit", item.id)}
                      className="admin-row-delete-btn"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                  <div className="admin-card-body">
                    <div className="admin-payload-dump">
                      {Object.entries(item.payload).map(([k, v]) => (
                        <div key={k} className="payload-row">
                          <span className="key">{k}:</span>{" "}
                          <span className="val">
                            {typeof v === "object" && v !== null ? (
                              <div
                                className="nested-payload"
                                style={{ paddingLeft: "15px" }}
                              >
                                {Object.entries(v).map(([nestedK, nestedV]) => (
                                  <div key={nestedK} className="nested-row">
                                    <span className="nested-key">
                                      {nestedK}:
                                    </span>{" "}
                                    <span className="nested-val">
                                      {String(nestedV)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              String(v)
                            )}
                          </span>
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
              <p className="text-muted text-center p-md">
                No users registerd yet.
              </p>
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
                        <span style={{ fontWeight: "700" }}>
                          {account.username}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-sm">
                      {isSelf && (
                        <span className="admin-status-pill active">
                          <FontAwesomeIcon icon={faCircleCheck} /> ACTIVE
                        </span>
                      )}
                      <span className="admin-status-pill">
                        <FontAwesomeIcon icon={faShieldHalved} />{" "}
                        {account.role || "Operator"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "visibility" && (
          <section className="admin-regionals-panel">
            <div className="admin-regionals-panel-header">
              <div>
                <span className="scout-overline">Visualization Access</span>
                <h3>Regional Visibility</h3>
              </div>
              <span className="admin-regionals-count">
                {visibleRegionalCount} of {regionals.length} visible
              </span>
            </div>

            <div className="admin-regionals-list">
              {regionals.length === 0 ? (
                <p className="text-muted text-center p-md">
                  No regionals have been created yet.
                </p>
              ) : (
                regionals.map((regional) => {
                  const visible = !!regional.visible_in_vis;
                  return (
                    <div
                      key={regional.id}
                      className={`admin-regional-row ${visible ? "visible" : "hidden"}`}
                    >
                      <div className="admin-regional-main">
                        <span className="admin-regional-name">
                          {regional.name}
                        </span>
                      </div>
                      <button
                        className={`admin-visibility-toggle ${visible ? "visible" : "hidden"}`}
                        onClick={() => toggleRegionalVisibility(regional)}
                      >
                        <FontAwesomeIcon icon={visible ? faEye : faEyeSlash} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {activeTab === "apps" && (
          <section className="admin-regionals-panel">
            <div className="admin-regionals-panel-header">
              <div>
                <span className="scout-overline">Apps</span>
                <h3>Apps</h3>
              </div>
            </div>

            <div className="admin-regionals-list">
              <Link to="/form" rel="noopener noreferrer" className="adminApps">
                Form Builder
              </Link>
              <Link to="/pit" rel="noopener noreferrer" className="adminApps">
                Pit Scouting
              </Link>
              <Link to="/match" rel="noopener noreferrer" className="adminApps">
                Match Scouting
              </Link>
              <Link to="/vis" rel="noopener noreferrer" className="adminApps">
                Visualization
              </Link>
              <Link
                to="/scoutSeettings"
                rel="noopener noreferrer"
                className="adminApps"
              >
                Settings
              </Link>
            </div>
            <br />
            <br />

            <div className="admin-regionals-panel-header">
              <div>
                <h3>All Pages</h3>
              </div>
            </div>

            <div className="admin-regionals-list">
              <Link to="/form" rel="noopener noreferrer" className="adminApps">
                Mentor
              </Link>
              <Link to="/pit" rel="noopener noreferrer" className="adminApps">
                Parent Helper
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
