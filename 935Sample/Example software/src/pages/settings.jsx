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
} from "@fortawesome/free-solid-svg-icons";

export default function settingsPage () {
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
    return(
        <>
        <h1>Theme</h1>
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
        </>
    )
}