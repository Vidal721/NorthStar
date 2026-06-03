import { useState, useEffect } from "react";
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
  faClipboardList,
  faChartBar,
  faWrench,
  faHammer,
} from "@fortawesome/free-solid-svg-icons";
import MatchScout from "./pages/match";
import DataVis from "./pages/vis";
import PitScout from "./pages/pit";
import AdminDashboard from "./pages/admin";
import FormBuilder from "./pages/formbuilder";
import "./App.css";

const SECTIONS = [
  {
    id: "pitscout",
    title: "Pit Scouting",
    description: "Record robot specs and capabilities at the pits",
    icon: faWrench,
    to: "/pit",
    disabled: false,
  },
  {
    id: "mainscout",
    title: "Match Scouting",
    description: "Track team performance live during matches",
    icon: faClipboardList,
    to: "/match",
    disabled: false,
  },
  {
    id: "datavis",
    title: "Data Visualization",
    description: "Analyze and compare scouted data across teams",
    icon: faChartBar,
    to: "/vis",
    disabled: false,
  },
  {
    id: "formbuilder",
    title: "Form Builder",
    description: "Design and customize scouting form fields",
    icon: faHammer,
    to: "/form",
    disabled: false,
  },
];

function MainMenu() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [clickCount, setClickCount] = useState(0);
  const [hint, setHint] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const handleHeaderClick = () => {
    setClickCount((prev) => {
      const next = prev + 1;
      if (next === 7) {
        navigate("/admin");
        return 0;
      }
      if (next > 3) {
        setHint(`${7 - next} more to unlock admin`);
      }
      return next;
    });
  };

  return (
    <div className="menu-root">
      {/* Background decoration */}
      <div className="menu-bg-circle menu-bg-circle--1" aria-hidden="true" />
      <div className="menu-bg-circle menu-bg-circle--2" aria-hidden="true" />

      {/* Header */}
      <header className="menu-header">
        <div className="menu-header__inner">
          <div className="menu-team-badge" onClick={handleHeaderClick}>
            <span className="menu-team-badge__number">935</span>
          </div>

          <div className="menu-header__titles">
            <h1 className="menu-team-name" onClick={handleHeaderClick}>
              RaileRobotics
            </h1>
            <p className="menu-team-sub">FRC Scouting Hub · Season 2025</p>
            {hint && <p className="menu-hint">{hint}</p>}
          </div>

          <button
            className="theme-btn"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
          >
            <FontAwesomeIcon icon={theme === "light" ? faMoon : faSun} />
            <span>{theme === "light" ? "Dark" : "Light"}</span>
          </button>
        </div>
      </header>

      {/* Welcome strip */}
      <div className="menu-welcome">
        <p className="menu-welcome__text">
          Welcome, scouter! Choose a tool below to get started.
        </p>
      </div>

      {/* Cards grid */}
      <main className="menu-grid">
        {SECTIONS.map((s) => (
          <div key={s.id} className={`menu-card ${s.disabled ? "menu-card--disabled" : ""}`}>
            <div className="menu-card__icon" aria-hidden="true">
              <FontAwesomeIcon icon={s.icon} />
            </div>
            <div className="menu-card__body">
              <h2 className="menu-card__title">{s.title}</h2>
              <p className="menu-card__desc">{s.description}</p>
            </div>
            <Link
              to={s.disabled ? "#" : s.to}
              target={s.disabled ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="launch-btn"
              tabIndex={s.disabled ? -1 : 0}
              aria-disabled={s.disabled}
            >
              Launch <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            </Link>
          </div>
        ))}
      </main>

      {/* Footer */}
      <footer className="menu-footer">
        <p>Team 935 · FIRST Robotics Competition</p>
      </footer>
    </div>
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