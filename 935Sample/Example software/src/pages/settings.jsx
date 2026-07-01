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
  const navigate = useNavigate();
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  const isDisabled = false;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  function goBackToPage () {
    let currentRole = localStorage.getItem("userRole");
    if (currentRole === "admin"){
      navigate("/admin");
    } else if (currentRole === "scout"){
      navigate("/scout")
    } else {
      navigate("/")
    }
  }
    return(
        <>
        <button onClick={goBackToPage}>Back</button>
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