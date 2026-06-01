import { useState, useEffect } from "react"; // Added hooks
import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import MatchScout from "./pages/match";
import DataVis from "./pages/vis";
import PitScout from "./pages/pit";
import AdminDashboard from "./pages/admin";
import "./App.css";

function MainMenu() {
  // 1. Manage theme state inside the component
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  const isDisabled = true; 

  // 2. Update the HTML attribute whenever the theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <>
      <h1 className="headertext">Welcome scouter!</h1>
      <div>
        <h1 className="headertext">choose what to start</h1>

        <button
          className="theme-btn"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          <span className="icon-sun">☀️</span>
          <span className="icon-moon">🌙</span>
          <span className="theme-text">Switch Theme</span>
        </button>

        <div id="pitscout" className="launchdiv">
          <h1>Pitscouting</h1>

          <Link
            to={isDisabled ? "#" : "/pit"}
            target={isDisabled ? undefined : "_blank"}
            rel="noopener noreferrer"
            className={`launch-btn ${isDisabled ? "disabled-link" : ""}`}
            tabIndex={isDisabled ? -1 : 0} /* Prevents keyboard tabbing */
          >
            Coming Soon
          </Link>
        </div>

        <div id="mainscout" className="launchdiv">
          <h1>Match Scouting</h1>
          <Link
            to="/match"
            target="_blank"
            rel="noopener noreferrer"
            className="launch-btn"
            id="startMatchScout"
          >
            Launch
          </Link>
        </div>

        <div id="datavis" className="launchdiv">
          <h1>Data visualization</h1>
          <Link
            to="/vis"
            target="_blank"
            rel="noopener noreferrer"
            className="launch-btn"
            id="startVis"
          >
            Launch
          </Link>
        </div>
        <div id="admin" className="launchdiv">
          <h1>Admin</h1>
          <Link
            to="/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="launch-btn"
            id="startVis"
          >
            Launch
          </Link>
        </div>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/pit" element={<PitScout />} />
        <Route path="/match" element={<MatchScout />} />
        <Route path="/vis" element={<DataVis />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
