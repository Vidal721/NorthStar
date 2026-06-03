import { useState, useEffect } from "react"; // Added hooks
import {
  BrowserRouter,
  Route,
  Routes,
  Link,
  useNavigate,
} from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMoon,
  faSun,
  faArrowUpRightFromSquare,
  faBinoculars,
  faX,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import MatchScout from "./pages/match";
import DataVis from "./pages/vis";
import PitScout from "./pages/pit";
import AdminDashboard from "./pages/admin";
import FormBuilder from "./pages/formbuilder";
import "./App.css";

function ScouterMenu() {
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

      if (nextCount > 3) {
        document.getElementById("count").textContent =
          7 - nextCount + " clicks to open admin";
      }

      return nextCount;
    });
  };

  function getUser(){

    return localStorage.getItem("Current")
  }

  function handleLogOut (){
    localStorage.setItem("Current", "")
    navigate("/");
  }
  return (
    <>
      <div id="header">
          <img
            src="/pwa-512x512-removebg.png"
            alt="935 scouting logo"
            className="logo"
            id="logo"
          />
        <h1 className="headertext" onClick={handleHeaderClick}>
          North <strong id="strong">Star</strong>
        </h1>
        <button className="redZone2" onClick={handleLogOut}>
          <FontAwesomeIcon icon={faRightFromBracket} />
        </button>
      </div>
      <div id="count"></div>
      <div id="main-menu-container">
        <h1 className="introtext">Welcome, {getUser()}</h1>
        <button
          className="theme-btn"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          <span className="icon-sun">
            <FontAwesomeIcon icon={faSun} />
          </span>
          <span className="icon-moon">
            <FontAwesomeIcon icon={faMoon} />
          </span>
          <span className="theme-text">Switch Theme</span>
        </button>
        <div id="divs">
          <div id="datavis" className="launchdiv">
            <h1 className="divHeader">Vantage</h1>
            <p>Data the simple way.</p>
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

          <div id="pitscout" className="launchdiv">
            <h1 className="divHeader">
              Corner<strong>Stone</strong>
            </h1>
            <p>Core technical specifications and pit diagnostics</p>

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
            <h1 className="divHeader">Horizon</h1>
            <p>Real-time match tracking and performance analytics.</p>
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

          <div id="formbuilder" className="launchdiv">
            <h1 className="divHeader">Blueprint</h1>
            <p>Dynamic data schema and form configuration.</p>
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
      </div>
    </>
  );
}

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

  const handleScoutLogin = () => {
    // Functional state update ensures accuracy if clicks happen rapidly

    const password = "team935!";
    const name = document.getElementById("username").value;
    const userInput = document.getElementById("Password").value;
    if (userInput === password) {
      localStorage.setItem("Current", name)
      document.getElementById("failed").style.display = "none"
      navigate("/scoutdash");
      handleClose()
      
    } else {
      document.getElementById("failed").style.display = "block"
    }
  };

  function handleLogin (){
    const overlay = document.getElementById("loginDivBack");
    const login = document.getElementById("loginDiv");

    overlay.style.display = "block"
    login.style.display = "block"
  }
  function handleClose (){
    const overlay = document.getElementById("loginDivBack");
    const login = document.getElementById("loginDiv");

    overlay.style.display = "none"
    login.style.display = "none"
  }

  return (
    <>
      <img
        src="/pwa-512x512-removebg.png"
        alt="935 scouting logo"
        className="logo"
        id="logo"
      />
      <div id="header">
        <h1 className="headertext">
          North<strong id="strong">Star</strong>
        </h1>
        <img
          src="/pwa-512x512-removebg.png"
          alt="935 scouting logo"
          className="logo"
          id="logo"
        />

        <button onClick={handleLogin} className="redZone">
          <FontAwesomeIcon icon={faBinoculars} />
        </button>
      </div>
      <div id="count"></div>
      <div id="main-menu-container">
        <h1 className="introtext">Choose which app to launch</h1>
        <button
          className="theme-btn"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          <span className="icon-sun">
            <FontAwesomeIcon icon={faSun} />
          </span>
          <span className="icon-moon">
            <FontAwesomeIcon icon={faMoon} />
          </span>
          <span className="theme-text">Switch Theme</span>
        </button>
        <div id="divs">
          <div id="datavis" className="launchdiv">
            <h1 className="divHeader">Vantage</h1>
            <p>Data the simple way.</p>
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
        </div>
      </div>
      <div id="loginDivBack"></div>
      <div id="loginDiv">
        <div id="close" onClick={handleClose}><FontAwesomeIcon icon={faX} /></div>
        <h1>Welcome Scouter</h1>
        <p>Login to continue</p>
        <input type="text" id="username" placeholder="Name"/><br />
        <p id="failed">Incorrect Password</p>
        <input type="password" id="Password" placeholder="Password"/><br />
        <button id="login" onClick={handleScoutLogin}>Login</button>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/scoutdash" element={<ScouterMenu />} />
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
