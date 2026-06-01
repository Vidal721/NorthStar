import { useState, useEffect } from "react";
//SAMPLE DASHBOARD NOT REAL OR FUCTIONAL
const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 1247,
    activeMatches: 23,
    totalMatches: 582,
    serverHealth: 98,
    avgResponseTime: 142,
    dataSize: 2.4,
  });

  const [users, setUsers] = useState([
    { id: 1, name: "Alex Chen", team: 3476, role: "Scout Lead", status: "active", matches: 45 },
    { id: 2, name: "Jordan Wei", team: 3476, role: "Scout", status: "active", matches: 32 },
    { id: 3, name: "Casey Murphy", team: 1690, role: "Strategy", status: "inactive", matches: 28 },
    { id: 4, name: "Morgan Lee", team: 254, role: "Scout Lead", status: "active", matches: 67 },
    { id: 5, name: "Taylor Smith", team: 1690, role: "Scout", status: "active", matches: 21 },
  ]);

  const [recentActivity, setRecentActivity] = useState([
    { id: 1, user: "Alex Chen", action: "Submitted match data", time: "2 min ago", type: "submit" },
    { id: 2, user: "Morgan Lee", action: "Updated team settings", time: "15 min ago", type: "update" },
    { id: 3, user: "Jordan Wei", action: "Synced scouting app", time: "34 min ago", type: "sync" },
    { id: 4, user: "Casey Murphy", action: "Generated report", time: "1 hr ago", type: "report" },
    { id: 5, user: "Taylor Smith", action: "Submitted match data", time: "2 hrs ago", type: "submit" },
  ]);

  const [selectedTab, setSelectedTab] = useState("overview");
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1419", color: "#e0e0e0", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "linear-gradient(180deg, rgba(20,24,32,0.95), rgba(20,24,32,0.8))", borderBottom: "1px solid rgba(100,120,140,0.2)", padding: "20px 28px", backdropFilter: "blur(8px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "1400px", margin: "0 auto" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>⚙️ ADMIN</h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888", fontWeight: 500 }}>Team 3476 Dashboard</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setSelectedTab("overview")} style={{ padding: "10px 16px", background: selectedTab === "overview" ? "rgba(88,166,255,0.2)" : "transparent", border: "1px solid " + (selectedTab === "overview" ? "rgba(88,166,255,0.5)" : "rgba(100,120,140,0.3)"), borderRadius: 6, color: selectedTab === "overview" ? "#58a6ff" : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>Overview</button>
            <button onClick={() => setSelectedTab("users")} style={{ padding: "10px 16px", background: selectedTab === "users" ? "rgba(88,166,255,0.2)" : "transparent", border: "1px solid " + (selectedTab === "users" ? "rgba(88,166,255,0.5)" : "rgba(100,120,140,0.3)"), borderRadius: 6, color: selectedTab === "users" ? "#58a6ff" : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>Users</button>
            <button onClick={() => setSelectedTab("activity")} style={{ padding: "10px 16px", background: selectedTab === "activity" ? "rgba(88,166,255,0.2)" : "transparent", border: "1px solid " + (selectedTab === "activity" ? "rgba(88,166,255,0.5)" : "rgba(100,120,140,0.3)"), borderRadius: 6, color: selectedTab === "activity" ? "#58a6ff" : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>Activity</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
        {selectedTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
              <div style={{ background: "linear-gradient(135deg, rgba(30,45,60,0.6), rgba(20,35,50,0.4))", border: "1px solid rgba(88,166,255,0.2)", borderRadius: 10, padding: "20px", position: "relative" }}>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Total Users</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#58a6ff", marginBottom: 8 }}>{stats.totalUsers}</div>
                <div style={{ fontSize: 10, color: "#555" }}>↑ 42 this month</div>
              </div>

              <div style={{ background: "linear-gradient(135deg, rgba(30,45,60,0.6), rgba(20,35,50,0.4))", border: "1px solid rgba(76,175,80,0.2)", borderRadius: 10, padding: "20px" }}>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Active Matches</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#4caf50", marginBottom: 8 }}>{stats.activeMatches}</div>
                <div style={{ fontSize: 10, color: "#555" }}>Live right now</div>
              </div>

              <div style={{ background: "linear-gradient(135deg, rgba(30,45,60,0.6), rgba(20,35,50,0.4))", border: "1px solid rgba(255,193,7,0.2)", borderRadius: 10, padding: "20px" }}>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Total Matches</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#ffc107", marginBottom: 8 }}>{stats.totalMatches}</div>
                <div style={{ fontSize: 10, color: "#555" }}>All time</div>
              </div>

              <div style={{ background: "linear-gradient(135deg, rgba(30,45,60,0.6), rgba(20,35,50,0.4))", border: "1px solid rgba(76,175,80,0.2)", borderRadius: 10, padding: "20px" }}>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Server Health</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: "#4caf50" }}>{stats.serverHealth}%</div>
                  <div style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", background: "#4caf50", boxShadow: "0 0 12px rgba(76,175,80,0.6)" }}></div>
                </div>
                <div style={{ fontSize: 10, color: "#555" }}>All systems green</div>
              </div>

              <div style={{ background: "linear-gradient(135deg, rgba(30,45,60,0.6), rgba(20,35,50,0.4))", border: "1px solid rgba(244,67,54,0.2)", borderRadius: 10, padding: "20px" }}>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Response Time</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#f44336", marginBottom: 8 }}>{stats.avgResponseTime}ms</div>
                <div style={{ fontSize: 10, color: "#555" }}>Avg latency</div>
              </div>

              <div style={{ background: "linear-gradient(135deg, rgba(30,45,60,0.6), rgba(20,35,50,0.4))", border: "1px solid rgba(155,39,176,0.2)", borderRadius: 10, padding: "20px" }}>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Data Size</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#9b27b0", marginBottom: 8 }}>{stats.dataSize}GB</div>
                <div style={{ fontSize: 10, color: "#555" }}>Database</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div style={{ background: "linear-gradient(135deg, rgba(30,45,60,0.4), rgba(20,35,50,0.2))", border: "1px solid rgba(100,120,140,0.2)", borderRadius: 10, padding: "24px" }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 700, color: "#e0e0e0" }}>Match Distribution</h3>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 120, paddingBottom: 12 }}>
                  <div style={{ flex: 1, background: "linear-gradient(180deg, #58a6ff, rgba(88,166,255,0.3))", borderRadius: "4px 4px 0 0", height: "85%", position: "relative" }}><span style={{ position: "absolute", bottom: "-24px", left: 0, right: 0, textAlign: "center", fontSize: 10, color: "#666" }}>Auto</span></div>
                  <div style={{ flex: 1, background: "linear-gradient(180deg, #4caf50, rgba(76,175,80,0.3))", borderRadius: "4px 4px 0 0", height: "72%", position: "relative" }}><span style={{ position: "absolute", bottom: "-24px", left: 0, right: 0, textAlign: "center", fontSize: 10, color: "#666" }}>Teleop</span></div>
                  <div style={{ flex: 1, background: "linear-gradient(180deg, #ffc107, rgba(255,193,7,0.3))", borderRadius: "4px 4px 0 0", height: "65%", position: "relative" }}><span style={{ position: "absolute", bottom: "-24px", left: 0, right: 0, textAlign: "center", fontSize: 10, color: "#666" }}>End</span></div>
                  <div style={{ flex: 1, background: "linear-gradient(180deg, #f44336, rgba(244,67,54,0.3))", borderRadius: "4px 4px 0 0", height: "55%", position: "relative" }}><span style={{ position: "absolute", bottom: "-24px", left: 0, right: 0, textAlign: "center", fontSize: 10, color: "#666" }}>Fail</span></div>
                </div>
              </div>

              <div style={{ background: "linear-gradient(135deg, rgba(30,45,60,0.4), rgba(20,35,50,0.2))", border: "1px solid rgba(100,120,140,0.2)", borderRadius: 10, padding: "24px" }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 700, color: "#e0e0e0" }}>Quick Stats</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(100,120,140,0.1)" }}>
                    <span style={{ fontSize: 12, color: "#aaa" }}>Avg matches/scout</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#58a6ff" }}>23.4</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(100,120,140,0.1)" }}>
                    <span style={{ fontSize: 12, color: "#aaa" }}>Avg accuracy</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#4caf50" }}>94.2%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(100,120,140,0.1)" }}>
                    <span style={{ fontSize: 12, color: "#aaa" }}>Uptime</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#4caf50" }}>99.8%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                    <span style={{ fontSize: 12, color: "#aaa" }}>Last sync</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#ffc107" }}>2 min ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === "users" && (
          <div>
            <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
              <input type="text" placeholder="Search users..." style={{ flex: 1, padding: "10px 14px", background: "rgba(30,45,60,0.5)", border: "1px solid rgba(100,120,140,0.2)", borderRadius: 6, color: "#e0e0e0", fontSize: 13 }} />
              <button style={{ padding: "10px 16px", background: "#58a6ff", color: "#0f1419", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>+ Add User</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {users.map((user) => (
                <div key={user.id} onClick={() => handleUserClick(user)} style={{ background: "linear-gradient(135deg, rgba(30,45,60,0.4), rgba(20,35,50,0.2))", border: "1px solid rgba(100,120,140,0.2)", borderRadius: 10, padding: "16px", cursor: "pointer", transition: "all 0.2s", hover: { borderColor: "rgba(88,166,255,0.4)" } }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e0e0", marginBottom: 2 }}>{user.name}</div>
                      <div style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>Team {user.team}</div>
                    </div>
                    <div style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: user.status === "active" ? "#4caf50" : "#888", boxShadow: user.status === "active" ? "0 0 8px rgba(76,175,80,0.6)" : "none" }}></div>
                  </div>
                  <div style={{ fontSize: 11, color: "#999", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(100,120,140,0.1)" }}>
                    <span style={{ background: "rgba(88,166,255,0.15)", color: "#58a6ff", padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{user.role}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    <div>Matches: <span style={{ color: "#ffc107", fontWeight: 600 }}>{user.matches}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedTab === "activity" && (
          <div>
            <div style={{ background: "linear-gradient(135deg, rgba(30,45,60,0.4), rgba(20,35,50,0.2))", border: "1px solid rgba(100,120,140,0.2)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(100,120,140,0.2)", display: "flex", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e0e0e0" }}>Recent Activity</h3>
                <button style={{ padding: "6px 12px", background: "transparent", border: "1px solid rgba(100,120,140,0.3)", borderRadius: 4, color: "#888", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Clear Log</button>
              </div>
              <div style={{ padding: 0 }}>
                {recentActivity.map((activity, idx) => (
                  <div key={activity.id} style={{ padding: "14px 20px", borderBottom: idx < recentActivity.length - 1 ? "1px solid rgba(100,120,140,0.1)" : "none", display: "flex", gap: 14, alignItems: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: activity.type === "submit" ? "rgba(76,175,80,0.2)" : activity.type === "update" ? "rgba(88,166,255,0.2)" : activity.type === "sync" ? "rgba(255,193,7,0.2)" : "rgba(155,39,176,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                      {activity.type === "submit" ? "✓" : activity.type === "update" ? "↻" : activity.type === "sync" ? "⟲" : "📊"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", marginBottom: 2 }}>{activity.user}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{activity.action}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#666", fontWeight: 500, textAlign: "right" }}>{activity.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showUserModal && selectedUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setShowUserModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a2332", border: "1px solid rgba(100,120,140,0.3)", borderRadius: 12, padding: "28px", width: "90%", maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e0e0e0" }}>{selectedUser.name}</h2>
              <button onClick={() => setShowUserModal(false)} style={{ background: "transparent", border: "none", color: "#888", fontSize: 24, cursor: "pointer", padding: 0 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding: "12px", background: "rgba(30,45,60,0.3)", borderRadius: 6, borderLeft: "3px solid #58a6ff" }}>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700, marginBottom: 4 }}>TEAM</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#58a6ff" }}>Team {selectedUser.team}</div>
              </div>
              <div style={{ padding: "12px", background: "rgba(30,45,60,0.3)", borderRadius: 6, borderLeft: "3px solid #4caf50" }}>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700, marginBottom: 4 }}>ROLE</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#4caf50" }}>{selectedUser.role}</div>
              </div>
              <div style={{ padding: "12px", background: "rgba(30,45,60,0.3)", borderRadius: 6, borderLeft: "3px solid #ffc107" }}>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700, marginBottom: 4 }}>STATUS</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: selectedUser.status === "active" ? "#4caf50" : "#f44336", textTransform: "capitalize" }}>{selectedUser.status}</div>
              </div>
              <div style={{ padding: "12px", background: "rgba(30,45,60,0.3)", borderRadius: 6, borderLeft: "3px solid #9b27b0" }}>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700, marginBottom: 4 }}>MATCHES SCOUTED</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#9b27b0" }}>{selectedUser.matches}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button style={{ flex: 1, padding: "10px", background: "rgba(88,166,255,0.2)", border: "1px solid rgba(88,166,255,0.4)", borderRadius: 6, color: "#58a6ff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Edit User</button>
              <button style={{ flex: 1, padding: "10px", background: "rgba(244,67,54,0.2)", border: "1px solid rgba(244,67,54,0.4)", borderRadius: 6, color: "#f44336", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Deactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;