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
  faPlus,
  faClock,
  faGear,
  faChartColumn,
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

  function logout() {
    navigate("/");
  }

  function getInitials() {
    const name = localStorage.getItem("currentUser");

    // 1. Check if a name actually exists in localStorage
    if (!name) return "";

    // 2. Clean up any extra spaces and get the very first character
    const firstInitial = name.trim().charAt(0);

    // 3. Return it in uppercase
    return firstInitial.toUpperCase();
  }

  return (
    <>
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

        <button onClick={logout} className="avatar">
          {getInitials()}
        </button>
      </div>
      <div id="count"></div>
      <div id="main-menu-container">
        <div id="divs">
          <Link to="/match" rel="noopener noreferrer">
            <div id="datavis" className="launchdiv">
              <div className="divIcon">
                <FontAwesomeIcon icon={faPlus} />
              </div>
              <h1>New Match</h1>
              <p>Submit new match data</p>
            </div>
            </Link>
            <Link to="/pit" rel="noopener noreferrer">
            <div id="datavis" className="launchdiv">
              <div className="divIcon">
                <FontAwesomeIcon icon={faPlus} />
              </div>
              <h1>New Pit</h1>
              <p>Submit new pit data</p>
            </div>
            </Link>
                        <Link to="/match" rel="noopener noreferrer">
            <div id="datavis" className="launchdiv">
              <div className="divIcon">
                <FontAwesomeIcon icon={faChartColumn} />
              </div>
              <h1>View Data</h1>
              <p>Look at the most recent data available</p>
            </div>
            </Link>
            <Link to="" rel="noopener noreferrer">
            <div id="datavis" className="launchdiv">
              <div className="divIcon">
                <FontAwesomeIcon icon={faClock} />
              </div>
              <h1>Schedule</h1>
              <p>
                View current upload schedulee, and see which teams you scout
                next
              </p>
            </div>
            </Link>
            <Link to="/scoutSeettings" rel="noopener noreferrer">
            <div id="datavis" className="launchdiv">
              <div className="divIcon">
                <FontAwesomeIcon icon={faGear} />
              </div>
              <h1>Settings</h1>
              <p>Customize theme, and manage account</p>
            </div>
            </Link>
        </div>
      </div>
    </>
  );
}
