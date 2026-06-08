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

export default function MainMenu() {
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

  const navigate = useNavigate();

  const handleScoutLogin = () => {
    // Functional state update ensures accuracy if clicks happen rapidly

    const password = "team935!";
    const userInput = prompt("Password");

    if (userInput === password) {
      navigate("/scoutdash");
    } else {
      alert("incorrect password");
      navigate("/");
    }
  };

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
          North <strong id="strong">Star</strong>
        </h1>
        <img
          src="/pwa-512x512-removebg.png"
          alt="935 scouting logo"
          className="logo"
          id="logo"
        />

          <button onClick={handleScoutLogin} className="redZone">
            <FontAwesomeIcon icon={faBinoculars} />
          </button>
      </div>
      <div id="count"></div>
      <div id="main-menu-container">
        <h1 className="headertext">Choose which app to launch</h1>
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
            <h1>New</h1>
            <Link
              to="/vis"
              target="_blank"
              rel="noopener noreferrer"
              className="launch-btn"
              id="startVis"
            >
              New <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}