import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChartLine,
  faFolderOpen,
  faRightFromBracket,
  faUser,
  faX,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";

const helperTabs = [
  { id: "dashboard", label: "Dashboard", icon: faChartLine },
  { id: "drive", label: "Drive", icon: faFolderOpen },
];

export default function HelperPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  const currentHelper = localStorage.getItem("currentUser") || "Helper";

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
      <div
        className={`mobileSidebarOverlay ${isSidebarOpen ? "active" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <FontAwesomeIcon icon={faX} id="closeBTN" />
      </div>

      <div className={`mobileSidebar ${isSidebarOpen ? "active" : ""}`}>
        {helperTabs.map((tab) => (
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
        {helperTabs.map((tab) => (
          <button
            key={tab.id}
            className={`admin-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <FontAwesomeIcon icon={tab.icon} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-content-viewport">
        {activeTab === "dashboard" && (
          <section>
            <h1>Dashboard</h1>
          </section>
        )}

        {activeTab === "drive" && (
          <section>
            <h1>Drive</h1>
          </section>
        )}
      </div>
    </div>
  );
}
