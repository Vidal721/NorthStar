import { useEffect, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";

export default function AnnouncementBell() {
  const api = useURL();
  const actor = localStorage.getItem("currentUser") || "";
  const [announcements, setAnnouncements] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef(null);
  const isFirstLoad = useRef(true);

  // Request browser Notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Fetch announcements
  const fetchAnnouncements = async () => {
    if (!actor) return;
    try {
      const res = await fetch(`${api}/messages?actor=${encodeURIComponent(actor)}`, {
        headers: { "ngrok-skip-browser-warning": "69420" },
      });
      if (res.ok) {
        const allMessages = await res.json();
        // Filter for announcements
        const annList = allMessages.filter(
          (msg) => msg.recipient_type === "announcement"
        );
        
        // Sort by date descending (newest first)
        annList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Get read announcement IDs from localStorage
        const readIds = JSON.parse(localStorage.getItem("read_announcements") || "[]");

        // Calculate unread
        const unread = annList.filter((ann) => !readIds.includes(ann.id));
        setUnreadCount(unread.length);

        // Check if there are new announcements to notify (only if it's not the very first page load)
        if (!isFirstLoad.current && unread.length > 0) {
          const oldAnnouncements = announcements;
          // Find announcements in the new list that are not in the previous state announcements
          const brandNew = unread.filter(
            (newAnn) => !oldAnnouncements.some((oldAnn) => oldAnn.id === newAnn.id)
          );

          if (brandNew.length > 0 && Notification.permission === "granted") {
            brandNew.forEach((msg) => {
              new Notification(`North Star Announcement from ${msg.sender}`, {
                body: msg.body,
                icon: "/pwa-512x512.png",
              });
            });
          }
        }

        setAnnouncements(annList);
        isFirstLoad.current = false;
      }
    } catch (err) {
      console.error("Error fetching announcements:", err);
    }
  };

  // Set up polling (every 8 seconds)
  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 8000);
    return () => clearInterval(interval);
  }, [actor, api]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mark all as read
  const markAllAsRead = () => {
    const readIds = announcements.map((ann) => ann.id);
    localStorage.setItem("read_announcements", JSON.stringify(readIds));
    setUnreadCount(0);
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
    if (!dropdownOpen && unreadCount > 0) {
      // Keep them unread until they mark all as read or close, but let's allow explicit mark all as read
    }
  };

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " " + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
      return "";
    }
  };

  const readIds = JSON.parse(localStorage.getItem("read_announcements") || "[]");

  return (
    <div className="announcement-bell-container" ref={containerRef} onClick={toggleDropdown} title="Announcements">
      <FontAwesomeIcon icon={faBell} size="lg" />
      {unreadCount > 0 && (
        <span className="announcement-bell-badge">{unreadCount}</span>
      )}

      {dropdownOpen && (
        <div className="announcement-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="announcement-dropdown-header">
            <span>Announcements</span>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead}>Mark all as read</button>
            )}
          </div>
          <div className="announcement-list">
            {announcements.length === 0 ? (
              <div className="announcement-empty">No announcements yet.</div>
            ) : (
              announcements.map((ann) => {
                const isUnread = !readIds.includes(ann.id);
                return (
                  <div key={ann.id} className={`announcement-item ${isUnread ? "unread" : ""}`}>
                    <div className="announcement-item-top">
                      <span className="announcement-item-sender">{ann.sender}</span>
                      <span>{formatTime(ann.created_at)}</span>
                    </div>
                    <div className="announcement-item-body">{ann.body}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
