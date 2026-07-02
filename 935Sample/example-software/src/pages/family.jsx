import { useState, useEffect } from "react"; 
import { useNavigate } from "react-router-dom";
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
              <p>Stay connected, track your students, and support the team from the stands.</p>
            </div>

            <div id="divs">
              <div className="launchdiv family-card" onClick={() => setActiveTab("media")}>
                <div className="divIcon family-icon"><FontAwesomeIcon icon={faImages} /></div>
                <h1>Upload Media</h1>
                <p>Share match photos and pit moments straight to the team drive.</p>
              </div>

              <div className="launchdiv family-card" onClick={() => setActiveTab("schedule")}>
                <div className="divIcon family-icon"><FontAwesomeIcon icon={faCalendarDays} /></div>
                <h1>Schedules</h1>
                <p>View match timings, scouting shifts, and team meal plans.</p>
              </div>

              <div className="launchdiv family-card" onClick={() => setActiveTab("updates")}>
                <div className="divIcon family-icon"><FontAwesomeIcon icon={faBullhorn} /></div>
                <h1>Live Updates</h1>
                <p>See real-time announcements from the pit and drive team leads.</p>
              </div>

              <div className="launchdiv family-card" onClick={() => setActiveTab("advice")}>
                <div className="divIcon family-icon"><FontAwesomeIcon icon={faLightbulb} /></div>
                <h1>Parent Pit Stop</h1>
                <p>Submit logistical advice, coordinate rides, or offer extra supplies.</p>
              </div>

              <div className="launchdiv family-card" onClick={() => setActiveTab("shoutouts")}>
                <div className="divIcon family-icon shout-icon"><FontAwesomeIcon icon={faHeart} /></div>
                <h1>Shout-Outs</h1>
                <p>Send encouraging words directly to our hard-working students!</p>
              </div>
            </div>
          </>
        )}

        {/* FEATURE SCREEN: MEDIA UPLOAD */}
        {activeTab === "media" && (
          <div className="feature-panel">
            <h2><FontAwesomeIcon icon={faImages} className="family-icon" /> Upload Event Media</h2>
            <p>Took an awesome shot of the robot hanging or a funny team photo? Upload it directly to the team repository!</p>
            
            <label className="file-upload-label">
              <FontAwesomeIcon icon={faUpload} /> Choose Files to Upload
              <input type="file" multiple accept="image/*" onChange={handleImageChange} style={{display: 'none'}} />
            </label>

            <div className="photo-preview-grid">
              {photos.map((src, idx) => (
                <div key={idx} className="preview-card">
                  <img src={src} alt="Uploaded snapshot" />
                  <span className="upload-badge">Staged for Drive</span>
                </div>
              ))}
              {photos.length === 0 && <p className="empty-msg">No images selected yet. Staged photos will appear here.</p>}
            </div>
          </div>
        )}

        {/* FEATURE SCREEN: SCHEDULES */}
        {activeTab === "schedule" && (
          <div className="feature-panel">
            <h2><FontAwesomeIcon icon={faCalendarDays} className="family-icon" /> Competition Master Schedule</h2>
            <p>Track matches and see where students are assigned to scout or work.</p>
            <table className="family-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event / Match</th>
                  <th>Who's Active</th>
                </tr>
              </thead>
              <tbody>
                {scheduleData.map((row, idx) => (
                  <tr key={idx}>
                    <td><strong>{row.time}</strong></td>
                    <td>{row.event}</td>
                    <td><span className="table-badge">{row.assignment}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FEATURE SCREEN: LIVE UPDATES */}
        {activeTab === "updates" && (
          <div className="feature-panel">
            <h2><FontAwesomeIcon icon={faBullhorn} className="family-icon" /> Pit Announcements</h2>
            <p>Stay informed with urgent bulletins direct from the drive team and mentors.</p>
            <div className="timeline">
              {announcements.map((item, idx) => (
                <div className="timeline-item" key={idx}>
                  <span className="timeline-time">{item.time}</span>
                  <p className="timeline-msg">{item.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FEATURE SCREEN: PARENT ADVICE */}
        {activeTab === "advice" && (
          <div className="feature-panel">
            <h2><FontAwesomeIcon icon={faLightbulb} className="family-icon" /> Parent Pit Stop (Advice & Logistics)</h2>
            <p>Need to organize a snack run? Coordinate carpools back to the hotel? Put your suggestions or logistics notes here.</p>
            
            <form onSubmit={handleAddAdvice} className="feature-form">
              <textarea 
                value={newAdvice} 
                onChange={(e) => setNewAdvice(e.target.value)}
                placeholder="Type logistical advice or food alerts here (e.g., 'Brought 2 extra cases of water behind the bleachers')..."
                required
              />
              <button type="submit" className="submit-btn">
                Submit Logistics Note <FontAwesomeIcon icon={faPaperPlane} />
              </button>
            </form>

            <div className="submitted-advice-section">
              <h3>Active Logistics Notes</h3>
              {adviceList.map((adv) => (
                <div key={adv.id} className="advice-node">
                  <span className="advice-timestamp">{adv.time}</span>
                  <p>{adv.text}</p>
                </div>
              ))}
              {adviceList.length === 0 && <p className="empty-msg">No logistical notes submitted yet today.</p>}
            </div>
          </div>
        )}

        {/* FEATURE SCREEN: SHOUT-OUTS */}
        {activeTab === "shoutouts" && (
          <div className="feature-panel">
            <h2><FontAwesomeIcon icon={faHeart} className="shout-icon" /> Fan Zone Cheer Board</h2>
            <p>Post uplifting comments or shout-outs for individual team members or the whole crew!</p>
            
            <form onSubmit={handleAddShout} className="shout-form">
              <input 
                type="text" 
                placeholder="Your Name/Relation (e.g., Mia's Dad)" 
                value={newShoutAuthor}
                onChange={(e) => setNewShoutAuthor(e.target.value)}
              />
              <textarea 
                placeholder="Write your words of encouragement here..." 
                value={newShoutText}
                onChange={(e) => setNewShoutText(e.target.value)}
                required
              />
              <button type="submit" className="submit-btn cheer-btn">
                Post Cheer! <FontAwesomeIcon icon={faHeart} />
              </button>
            </form>

            <div className="cheer-grid">
              {shoutOuts.map((shout) => (
                <div key={shout.id} className="cheer-card">
                  <p className="cheer-text">"{shout.text}"</p>
                  <h4 className="cheer-author">- {shout.author}</h4>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}