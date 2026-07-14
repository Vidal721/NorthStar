import { useEffect, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCommentDots,
  faPaperPlane,
  faPlus,
  faX,
  faArrowLeft,
  faBullhorn,
  faComments,
  faUser,
  faUsers,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";

export default function MessagingDrawer() {
  const api = useURL();
  const actor = localStorage.getItem("currentUser") || "";
  const actorRole = localStorage.getItem("userRole") || "";
  const actorSubgroup = localStorage.getItem("userSubgroup") || "";
  
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [subgroups, setSubgroups] = useState([]);
  const [groups, setGroups] = useState([]);
  
  // Navigation states
  // activeThread: null (shows conversations list) or { type: "everyone"|"subgroup"|"group"|"person", value: string, name: string }
  const [activeThread, setActiveThread] = useState(null);
  
  // Plus Modal states
  const [showPlusModal, setShowPlusModal] = useState(false);
  const [plusView, setPlusView] = useState("menu"); // "menu" | "dm" | "group" | "announcement"
  
  // Form values
  const [messageBody, setMessageBody] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [announcementText, setAnnouncementText] = useState("");
  const [dmTarget, setDmTarget] = useState("");
  const [newDmTarget, setNewDmTarget] = useState(null); // To handle starting DM with a new user who has no history yet

  const messagesEndRef = useRef(null);

  // Load chats data
  const load = async () => {
    if (!actor) return;
    try {
      const [m, u, s, g] = await Promise.all([
        fetch(`${api}/messages?actor=${encodeURIComponent(actor)}`, { headers: { "ngrok-skip-browser-warning": "69420" } }),
        fetch(`${api}/directory?actor=${encodeURIComponent(actor)}`, { headers: { "ngrok-skip-browser-warning": "69420" } }),
        fetch(`${api}/subgroups`, { headers: { "ngrok-skip-browser-warning": "69420" } }),
        fetch(`${api}/message-groups?actor=${encodeURIComponent(actor)}`, { headers: { "ngrok-skip-browser-warning": "69420" } }),
      ]);
      
      if (m.ok) setMessages(await m.json());
      if (u.ok) setUsers(await u.json());
      if (s.ok) setSubgroups(await s.json());
      if (g.ok) setGroups(await g.json());
    } catch (err) {
      console.error("Failed to load messaging data:", err);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      // Poll messages every 5 seconds while drawer is open
      const interval = setInterval(load, 5000);
      return () => clearInterval(interval);
    }
  }, [open]);

  // Scroll to bottom when message list or active thread changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeThread]);

  // Send message in the active thread
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageBody.trim() || !activeThread) return;

    const res = await fetch(`${api}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor,
        recipientType: activeThread.type,
        recipientValue: activeThread.value,
        body: messageBody,
      }),
    });

    if (res.ok) {
      setMessageBody("");
      if (newDmTarget) {
        setNewDmTarget(null); // DM now has history, clear temporary state
      }
      load();
    }
  };

  // Create message group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const res = await fetch(`${api}/message-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor,
        name: groupName,
        members: groupMembers,
      }),
    });

    if (res.ok) {
      const newGroup = await res.json();
      setGroupName("");
      setGroupMembers([]);
      setShowPlusModal(false);
      await load();
      // Auto-enter the newly created group chat
      setActiveThread({
        type: "group",
        value: newGroup.id,
        name: newGroup.name,
      });
    }
  };

  // Create Direct Message
  const handleCreateDm = (e) => {
    e.preventDefault();
    if (!dmTarget) return;

    setShowPlusModal(false);
    
    // Check if DM partner already exists in messages
    const hasHistory = messages.some(
      (m) =>
        m.recipient_type === "person" &&
        ((m.sender === dmTarget && m.recipient_value === actor) ||
          (m.sender === actor && m.recipient_value === dmTarget))
    );

    const threadInfo = {
      type: "person",
      value: dmTarget,
      name: dmTarget,
    };

    if (!hasHistory) {
      setNewDmTarget(dmTarget);
    }
    
    setActiveThread(threadInfo);
    setDmTarget("");
  };

  // Create Announcement
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    const res = await fetch(`${api}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor,
        recipientType: "announcement",
        recipientValue: "",
        body: announcementText,
      }),
    });

    if (res.ok) {
      setAnnouncementText("");
      setShowPlusModal(false);
      await load();
      // Open everyone thread or stay in thread list
      setActiveThread({
        type: "everyone",
        value: "",
        name: "Everyone Chat",
      });
    }
  };

  // Delete a message (admin/coach only)
  const deleteMessage = async (msgId) => {
    if (!window.confirm("Delete this message permanently?")) return;
    try {
      const res = await fetch(`${api}/messages/${encodeURIComponent(msgId)}?actor=${encodeURIComponent(actor)}`, {
        method: "DELETE",
        headers: { "ngrok-skip-browser-warning": "69420" },
      });
      if (res.ok) {
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete message.");
      }
    } catch (err) {
      alert("Error deleting message.");
    }
  };

  const isAdminOrCoach = ["admin", "coach"].includes(actorRole.toLowerCase());

  // Helper: Format message time
  const formatMsgTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  };

  // Helper: Get human-readable thread last message time
  const getThreadTime = (threadMsgs) => {
    if (!threadMsgs || threadMsgs.length === 0) return "";
    const last = threadMsgs[threadMsgs.length - 1];
    try {
      const date = new Date(last.created_at);
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  };

  // Process threads list based on messages
  const getThreadsList = () => {
    const list = [];

    // 1. Everyone Thread
    const everyoneMsgs = messages.filter((m) => m.recipient_type === "everyone");
    list.push({
      id: "everyone",
      name: "Everyone Chat",
      avatar: "EV",
      type: "everyone",
      value: "",
      messages: everyoneMsgs,
      lastMessage: everyoneMsgs[0] ? everyoneMsgs[0].body : "Start conversation here",
      time: getThreadTime(everyoneMsgs),
    });

    // 2. Subgroup Thread (for user's subgroup)
    if (actorSubgroup && actorSubgroup !== "none") {
      const subgroupMsgs = messages.filter(
        (m) => m.recipient_type === "subgroup" && m.recipient_value === actorSubgroup
      );
      list.push({
        id: `subgroup-${actorSubgroup}`,
        name: `${actorSubgroup} Subgroup`,
        avatar: actorSubgroup.slice(0, 2).toUpperCase(),
        type: "subgroup",
        value: actorSubgroup,
        messages: subgroupMsgs,
        lastMessage: subgroupMsgs[0] ? subgroupMsgs[0].body : `Chat with ${actorSubgroup} team`,
        time: getThreadTime(subgroupMsgs),
      });
    }

    // 3. Message Groups
    groups.forEach((g) => {
      const groupMsgs = messages.filter(
        (m) => m.recipient_type === "group" && m.recipient_value === g.id
      );
      list.push({
        id: `group-${g.id}`,
        name: g.name,
        avatar: g.name.slice(0, 2).toUpperCase(),
        type: "group",
        value: g.id,
        messages: groupMsgs,
        lastMessage: groupMsgs[0] ? groupMsgs[0].body : "Group chat created",
        time: getThreadTime(groupMsgs),
      });
    });

    // 4. Direct Messages (derived from messages history)
    const dmPartners = new Set();
    messages.forEach((m) => {
      if (m.recipient_type === "person") {
        if (m.sender === actor && m.recipient_value) {
          dmPartners.add(m.recipient_value);
        } else if (m.recipient_value === actor) {
          dmPartners.add(m.sender);
        }
      }
    });

    dmPartners.forEach((partner) => {
      const partnerMsgs = messages.filter(
        (m) =>
          m.recipient_type === "person" &&
          ((m.sender === partner && m.recipient_value === actor) ||
            (m.sender === actor && m.recipient_value === partner))
      );
      list.push({
        id: `person-${partner}`,
        name: partner,
        avatar: partner.slice(0, 2).toUpperCase(),
        type: "person",
        value: partner,
        messages: partnerMsgs,
        lastMessage: partnerMsgs[0] ? partnerMsgs[0].body : "",
        time: getThreadTime(partnerMsgs),
      });
    });

    // Sort threads so that threads with the most recent messages are at the top
    list.sort((a, b) => {
      const aTime = a.messages[0] ? new Date(a.messages[0].created_at).getTime() : 0;
      const bTime = b.messages[0] ? new Date(b.messages[0].created_at).getTime() : 0;
      return bTime - aTime;
    });

    return list;
  };

  // Get messages for the active thread
  const getActiveThreadMessages = () => {
    if (!activeThread) return [];
    
    if (activeThread.type === "everyone") {
      return messages
        .filter((m) => m.recipient_type === "everyone")
        .reverse();
    }
    if (activeThread.type === "subgroup") {
      return messages
        .filter((m) => m.recipient_type === "subgroup" && m.recipient_value === activeThread.value)
        .reverse();
    }
    if (activeThread.type === "group") {
      return messages
        .filter((m) => m.recipient_type === "group" && m.recipient_value === activeThread.value)
        .reverse();
    }
    if (activeThread.type === "person") {
      return messages
        .filter(
          (m) =>
            m.recipient_type === "person" &&
            ((m.sender === activeThread.value && m.recipient_value === actor) ||
              (m.sender === actor && m.recipient_value === activeThread.value))
        )
        .reverse();
    }
    return [];
  };

  const threads = getThreadsList();
  const threadMsgs = getActiveThreadMessages();
  const allowedToAnnounce = ["admin", "coach", "mentor"].includes(actorRole.toLowerCase()) || actorRole.toLowerCase() === "programmer";

  return (
    <>
      {/* Messages trigger floating button */}
      <button
        className="message-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open messages"
      >
        <FontAwesomeIcon icon={faCommentDots} />
      </button>

      {open && (
        <div className="message-drawer">
          {/* Drawer Header */}
          <div className="message-drawer-header">
            <div>
              <h2>Messages</h2>
              <p>Coaches monitor all conversations.</p>
            </div>
            <button onClick={() => setOpen(false)}>
              <FontAwesomeIcon icon={faX} />
            </button>
          </div>

          {/* VIEW 1: Conversations List */}
          {!activeThread && (
            <div className="chat-threads-container animate-pop">
              <div className="chat-threads-header">
                <span className="chat-threads-title">Conversations</span>
                <button
                  className="chat-plus-btn"
                  onClick={() => {
                    setPlusView("menu");
                    setShowPlusModal(true);
                  }}
                  title="Create chat or make announcement"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>

              <div className="chat-threads-list">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    className="chat-thread-item"
                    onClick={() => setActiveThread({ type: thread.type, value: thread.value, name: thread.name })}
                  >
                    <div className="chat-thread-avatar">{thread.avatar}</div>
                    <div className="chat-thread-details">
                      <div className="chat-thread-top">
                        <span className="chat-thread-name">{thread.name}</span>
                        <span className="chat-thread-time">{thread.time}</span>
                      </div>
                      <div className="chat-thread-bottom">
                        <span className="chat-thread-preview">{thread.lastMessage}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 2: Chat Detail / Messages Feed */}
          {activeThread && (
            <div className="chat-detail-container">
              <div className="chat-detail-header">
                <button className="chat-back-btn" onClick={() => {
                  setActiveThread(null);
                  setNewDmTarget(null);
                }}>
                  <FontAwesomeIcon icon={faArrowLeft} /> Chats
                </button>
                <div className="chat-detail-title-info">
                  <div className="chat-detail-title">{activeThread.name}</div>
                  <div className="chat-detail-subtitle">
                    {activeThread.type === "everyone" && "Global group chat"}
                    {activeThread.type === "subgroup" && `${activeThread.value} subgroup`}
                    {activeThread.type === "group" && "Private group chat"}
                    {activeThread.type === "person" && "Direct message"}
                  </div>
                </div>
              </div>

              {/* Message History */}
              <div className="chat-messages-scroll">
                 {threadMsgs.map((msg) => {
                   const isOutgoing = msg.sender === actor;
                   return (
                     <div
                       key={msg.id}
                       className={`message-bubble-wrapper ${isOutgoing ? "outgoing" : "incoming"}`}
                       style={{ position: "relative" }}
                     >
                       {!isOutgoing && activeThread.type !== "person" && (
                         <div className="message-bubble-sender">{msg.sender}</div>
                       )}
                       <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", flexDirection: isOutgoing ? "row-reverse" : "row" }}>
                         <div className="message-bubble">
                           {msg.body}
                           <span className="message-bubble-time">{formatMsgTime(msg.created_at)}</span>
                         </div>
                         {(isOutgoing || isAdminOrCoach) && (
                           <button
                             className="msg-delete-btn"
                             title="Delete message"
                             onClick={() => deleteMessage(msg.id)}
                           >
                             <FontAwesomeIcon icon={faTrash} />
                           </button>
                         )}
                       </div>
                     </div>
                   );
                 })}
                {newDmTarget && (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", margin: "20px 0" }}>
                    Starting a conversation with {newDmTarget}. Say hello!
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose Message Input */}
              <form className="chat-input-bar" onSubmit={handleSendMessage}>
                <textarea
                  className="chat-input-field"
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="iMessage"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={!messageBody.trim()}
                >
                  <FontAwesomeIcon icon={faPaperPlane} />
                </button>
              </form>
            </div>
          )}

          {/* Plus Actions Modal overlay */}
          {showPlusModal && (
            <div className="chat-modal-overlay">
              <div className="chat-modal-window">
                <div className="chat-modal-header">
                  <h3>
                    {plusView === "menu" && "Create Chat"}
                    {plusView === "dm" && "New Direct Message"}
                    {plusView === "group" && "New Group Chat"}
                    {plusView === "announcement" && "Make Announcement"}
                  </h3>
                  <button className="chat-modal-close" onClick={() => setShowPlusModal(false)}>
                    <FontAwesomeIcon icon={faX} />
                  </button>
                </div>

                <div className="chat-modal-body">
                  {/* Plus menu options */}
                  {plusView === "menu" && (
                    <>
                      <div className="chat-option-card" onClick={() => setPlusView("dm")}>
                        <FontAwesomeIcon icon={faUser} className="chat-option-icon" />
                        <div className="chat-option-text">
                          <h4>Direct Message</h4>
                          <p>Start a private chat with someone from directory</p>
                        </div>
                      </div>
                      <div className="chat-option-card" onClick={() => setPlusView("group")}>
                        <FontAwesomeIcon icon={faUsers} className="chat-option-icon" />
                        <div className="chat-option-text">
                          <h4>Create Message Group</h4>
                          <p>Start a group chat with multiple teammates</p>
                        </div>
                      </div>
                      {allowedToAnnounce && (
                        <div className="chat-option-card" onClick={() => setPlusView("announcement")}>
                          <FontAwesomeIcon icon={faBullhorn} className="chat-option-icon" />
                          <div className="chat-option-text">
                            <h4>Make Announcement</h4>
                            <p>Send team-wide notice with Chrome alert</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Form: Start Direct Message */}
                  {plusView === "dm" && (
                    <form onSubmit={handleCreateDm} className="chat-form-group">
                      <label htmlFor="select-dm-user">Teammate</label>
                      <select
                        id="select-dm-user"
                        className="chat-form-select"
                        value={dmTarget}
                        onChange={(e) => setDmTarget(e.target.value)}
                        required
                      >
                        <option value="">Choose a teammate...</option>
                        {users
                          .filter((u) => u.username !== actor)
                          .map((u) => (
                            <option key={u.username} value={u.username}>
                              {u.username} ({u.role})
                            </option>
                          ))}
                      </select>
                      <div className="chat-modal-footer" style={{ marginTop: "12px", border: "none", padding: 0 }}>
                        <button type="button" className="chat-btn secondary" onClick={() => setPlusView("menu")}>
                          Back
                        </button>
                        <button type="submit" className="chat-btn primary" disabled={!dmTarget}>
                          Chat
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Form: Create Message Group */}
                  {plusView === "group" && (
                    <form onSubmit={handleCreateGroup} className="chat-form-group">
                      <label htmlFor="group-name-input">Group Name</label>
                      <input
                        id="group-name-input"
                        type="text"
                        placeholder="e.g. Drive Team"
                        className="chat-form-input"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        required
                      />

                      <label style={{ marginTop: "8px" }}>Select Members</label>
                      <div className="chat-user-select-list">
                        {users.map((u) => (
                          <label key={u.username} className="chat-user-select-row">
                            <input
                              type="checkbox"
                              checked={groupMembers.includes(u.username)}
                              onChange={() =>
                                setGroupMembers((current) =>
                                  current.includes(u.username)
                                    ? current.filter((item) => item !== u.username)
                                    : [...current, u.username]
                                )
                              }
                            />
                            {u.username === actor ? `${u.username} (You)` : u.username}
                          </label>
                        ))}
                      </div>

                      <div className="chat-modal-footer" style={{ marginTop: "12px", border: "none", padding: 0 }}>
                        <button type="button" className="chat-btn secondary" onClick={() => setPlusView("menu")}>
                          Back
                        </button>
                        <button type="submit" className="chat-btn primary" disabled={!groupName.trim()}>
                          Create
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Form: Make Announcement */}
                  {plusView === "announcement" && (
                    <form onSubmit={handleCreateAnnouncement} className="chat-form-group">
                      <label htmlFor="announcement-text-input">Notice Content</label>
                      <textarea
                        id="announcement-text-input"
                        placeholder="Write announcement description..."
                        className="chat-form-textarea"
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        required
                      />
                      <div className="chat-modal-footer" style={{ marginTop: "12px", border: "none", padding: 0 }}>
                        <button type="button" className="chat-btn secondary" onClick={() => setPlusView("menu")}>
                          Back
                        </button>
                        <button type="submit" className="chat-btn primary" disabled={!announcementText.trim()}>
                          Broadcast Notice
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
