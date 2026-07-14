import { useState, useEffect } from "react"; 
import { useNavigate } from "react-router-dom";
import AnnouncementBell from "../componets/AnnouncementBell";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMoon,
  faSun,
  faImages,
  faCalendarDays,
  faBullhorn,
  faLightbulb,
  faHeart,
  faUpload,
  faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";

export default function MainMenu() {
  // Theme State
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  
  // Active Tab State to switch features instantly on-screen
  const [activeTab, setActiveTab] = useState("home");

  // Feature Sample States (Mocking backend data)
  const [photos, setPhotos] = useState([]);
  const [shoutOuts, setShoutOuts] = useState([
    { id: 1, author: "Proud Parent", text: "Amazing job on Match 12, Drive Team! Way to defend!" },
    { id: 2, author: "Grandma M.", text: "Watching the livestream from home, go Team 935!" }
  ]);
  const [adviceList, setAdviceList] = useState([]);
  
  // Form Inputs
  const [newShoutAuthor, setNewShoutAuthor] = useState("");
  const [newShoutText, setNewShoutText] = useState("");
  const [newAdvice, setNewAdvice] = useState("");

  // Sample Schedule Data
  const scheduleData = [
    { time: "10:30 AM", event: "Qualification Match 14", assignment: "Scouters Group A" },
    { time: "11:15 AM", event: "Qualification Match 22", assignment: "Drive Team" },
    { time: "12:00 PM", event: "Team Lunch at Pit", assignment: "Everyone / Family Welcome" },
    { time: "1:45 PM", event: "Qualification Match 35", assignment: "Scouters Group B" },
  ];

  // Sample Team Updates
  const announcements = [
    { time: "10:15 AM", message: "Alliance selection strategy meeting at the back bleachers right after Match 14." },
    { time: "9:00 AM", message: "Pit is officially open! Inspection passed on the first try! 🤖" },
  ];

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
    if (!name) return 'F';
    return name.trim().charAt(0).toUpperCase();
  }

  // Handle Image Upload Simulation
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const fileUrls = Array.from(e.target.files).map(file => URL.createObjectURL(file));
      setPhotos((prev) => [...prev, ...fileUrls]);
    }
  };

  // Handle Shout-out submit
  const handleAddShout = (e) => {
    e.preventDefault();
    if (!newShoutText.trim()) return;
    setShoutOuts([{ id: Date.now(), author: newShoutAuthor || "Anonymous Family Member", text: newShoutText }, ...shoutOuts]);
    setNewShoutAuthor("");
    setNewShoutText("");
  };

  // Handle Advice submit
  const handleAddAdvice = (e) => {
    e.preventDefault();
    if (!newAdvice.trim()) return;
    setAdviceList([{ id: Date.now(), text: newAdvice, time: "Just Now" }, ...adviceList]);
    setNewAdvice("");
    alert("Advice submitted to the pit manager dashboard!");
  };

  return (
    <>
      <div id="header">
        <h1 className="headertext" onClick={() => setActiveTab("home")} style={{cursor: 'pointer'}}>
          North <strong id="strong">Star</strong> <span className="hub-badge">Family Hub</span>
        </h1>
        <img
          src="/pwa-512x512-removebg.png"
          alt="935 scouting logo"
          className="logo"
          id="logo"
          onClick={() => setActiveTab("home")}
          style={{cursor: 'pointer'}}
        />

        <AnnouncementBell />
        <button onClick={logout} className="avatar" title="Logout">
          {getInitials()}
        </button>
      </div>

      <div id="main-menu-container">
        {/* Top bar containing navigation back to dashboard & Theme toggle */}
        <div className="utility-bar">
          {activeTab !== "home" && (
            <button className="back-btn" onClick={() => setActiveTab("home")}>← Back to Hub Dashboard</button>
          )}
          <button className="theme-btn" onClick={toggleTheme} aria-label="Toggle dark mode">
            <span className="icon-sun"><FontAwesomeIcon icon={faSun} /></span>
            <span className="icon-moon"><FontAwesomeIcon icon={faMoon} /></span>
            <span className="theme-text">Switch Theme</span>
          </button>
        </div>

        {/* MAIN HUB MENU GRAPHICS */}
        {activeTab === "home" && (
          <>
            <div className="welcome-banner">
              <h2>Welcome to the Team 935 Family Portal!</h2>
              <p>During season follow the progress of our robot, sign up for meals, and so much more!</p>
              <h3>Coming Soon!</h3>
            </div>
          </>
        )}

      </div>
    </>
  );
}