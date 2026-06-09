import { useState, useEffect } from "react"; // Added hooks
import {
  BrowserRouter,
  Route,
  Routes,
  Link,
  useNavigate,
  Navigate,
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
import GuestPage from "./pages/guest";
import MainScout from "./pages/scout";
import ScoutSettings from "./pages/settings"
import "./App.css";

function LoginScreen() {
  const navigate = useNavigate();

  function handleLogin () {
    const password = "1234";
    const userPassword = document.getElementById("password").value;
    const username = document.getElementById("email").value;

    if(password === userPassword) {
      localStorage.setItem("currentUser", username)
      navigate("/scout")
    }
  }

  // --- GLOBAL ENTER KEY LISTENER ---
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault(); // Prevents default form quirkiness
        handleLogin();
      }
    };

    // Attach listener to the window
    window.addEventListener("keydown", handleKeyDown);

    // Clean up the listener when leaving the login screen
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // Empty array ensures it only sets up once on mount
  // ---------------------------------

  return (
    <>
      <div id="loginContainer">
        <img
          src="/pwa-512x512-removebg.png"
          alt="935 scouting logo"
          className="mainLogo"
          id="mainLogo"
        />
        <p>Welcome! Please Login</p>
        <fieldset className="fieldset-container">
          <legend className="fieldset-legend">
            <label htmlFor="email">Username</label>
          </legend>
          <input type="email" id="email" className="fieldset-input"></input>
        </fieldset>
        <fieldset className="fieldset-container">
          <legend className="fieldset-legend">
            <label htmlFor="password">Password</label>
          </legend>
          <input type="password" id="password" className="fieldset-input"></input>
        </fieldset>
        <button id="mainLogin" onClick={handleLogin}>Login</button>
        <p>or</p>
        <Link to="/guest">
          <button id="guest">Continue as Guest</button>
        </Link>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/pit" element={<PitScout />} />
        <Route path="/match" element={<MatchScout />} />
        <Route path="/vis" element={<DataVis />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/form" element={<FormBuilder />} />
        <Route path="/scout" element={<MainScout />} />
        <Route path="/guest" element={<GuestPage />} />
        <Route path="/scoutSeettings" element={<ScoutSettings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;