import { useState, useEffect } from "react"; // Added hooks
import {
  BrowserRouter,
  Route,
  Routes,
  Link,
  useNavigate,
} from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faSun, faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import MatchScout from "./pages/match";
import DataVis from "./pages/vis";
import PitScout from "./pages/pit";
import AdminDashboard from "./pages/admin";
import FormBuilder from "./pages/formbuilder";
import "./App.css";

function MainMenu() {
  // 1. Manage theme state inside the component
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  const isDisabled = false;

  // 2. Update the HTML attribute whenever the theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const [clickCount, setClickCount] = useState(0);
  const navigate = useNavigate();

  const handleHeaderClick = () => {
    // Functional state update ensures accuracy if clicks happen rapidly
    setClickCount((prevCount) => {
      const nextCount = prevCount + 1;

      if (nextCount === 7) {
        navigate("/admin"); // Redirects using your React Router path
        return 0; // Resets the counter
      }

      if(nextCount > 3) {
        document.getElementById("count").textContent = 7 - nextCount + " clicks to open admin";
      }

      return nextCount;
    });
  };

  return (
    <>
      <h1 className="headertext" onClick={handleHeaderClick}>
        Welcome scouter!
      </h1>
      <div id="count"></div>
      <div id="main-menu-container">
        <h1 className="headertext">choose what to start</h1>

        <button
          className="theme-btn"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          <span className="icon-sun"><FontAwesomeIcon icon={faSun} /></span>
          <span className="icon-moon"><FontAwesomeIcon icon={faMoon} /></span>
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
            Launch <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
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
            Launch <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
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
            Launch <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </Link>
        </div>
        {/* Now has the 7 clicks feature on the welcom scouter
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
*/}
        <div id="formbuilder" className="launchdiv">
          <h1>Form Builder</h1>
          <Link
            to="/form"
            target="_blank"
            rel="noopener noreferrer"
            className="launch-btn"
            id="startVis"
          >
            Launch <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
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
        <Route path="/form" element={<FormBuilder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
