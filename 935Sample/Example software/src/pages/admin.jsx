import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { faReact } from "@fortawesome/free-brands-svg-icons";

const API_URL = "https://taco-childhood-jailbreak.ngrok-free.dev";
const LOCAL_URL = "http://localhost:3000";

export default function AdminDashboard() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData({ showFullScreenLoader: true });
  }, []);

  async function fetchData(options = { showFullScreenLoader: false }) {
    try {
      if (options.showFullScreenLoader) {
        setIsLoading(true);
      }

      const res = await fetch(`${API_URL}/match/data`, {
        headers: {
          "ngrok-skip-browser-warning": "69420",
        },
      });

      if (!res.ok) throw new Error("Failed to fetch data from server.");

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteItem(id) {
    try {
      const response = await fetch(`${API_URL}/delete/match/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        console.log("Successfully deleted");
        // Silently refresh data in the background without triggering full-screen loading
        fetchData({ showFullScreenLoader: false });
      } else {
        throw new Error("Failed to delete item from server.");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const deleteAll = async () => {
    if (!window.confirm("ARE YOU SURE?? This deletes EVERYTHING")) return;
    // sketchy way to delete - just a placeholder for now since we don't have a delete all endpoint
    alert("Delete all not implemented on server yet, but i tried!");
  };

  if (isLoading)
    return (
      <div
        style={{
          padding: 50,
          color: "white",
          background: "#000",
          height: "100vh",
        }}
      >
        Loading...
      </div>
    );
  if (error)
    return (
      <div
        style={{
          padding: 50,
          color: "red",
          background: "#000",
          height: "100vh",
        }}
      >
        Error: {error}
      </div>
    );

  return (
    <div
      style={{
        padding: 20,
        background: "#111",
        color: "#eee",
        minHeight: "100vh",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #444",
          paddingBottom: 10,
        }}
      >
        <h1>ADMIN SYSTEM v0.1</h1>
        <Link to="/" style={{ color: "#888", textDecoration: "none" }}>
          [ Back to Menu ]
        </Link>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <div style={{ padding: 20, border: "1px solid #444", flex: 1 }}>
          <h3>Total Submissions</h3>
          <p style={{ fontSize: 40, margin: 0 }}>{data.length}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 10,
              padding: "5px 10px",
              background: "#333",
              color: "#eee",
              border: "1px solid #555",
              cursor: "pointer",
            }}
          >
            REFRESH
          </button>
        </div>
        <div style={{ padding: 20, border: "1px solid #444", flex: 1 }}>
          <button
            onClick={deleteAll}
            style={{
              background: "red",
              color: "white",
              border: "none",
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            DELETE ALL DATA
          </button>
        </div>
      </div>

      <h2 style={{ marginTop: 40 }}>Raw Data Log</h2>
      <table
        style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}
      >
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #555" }}>
            <th style={{ padding: 10 }}>ID</th>
            <th style={{ padding: 10 }}>Team</th>
            <th style={{ padding: 10 }}>Match</th>
            <th style={{ padding: 10 }}>Scouter</th>
            <th style={{ padding: 10 }}>Full Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const time = row.meta?.timestamp
              ? row.meta.timestamp.replace("T", " ").split(".")[0]
              : "???";
            return (
              <tr key={row.id} style={{ borderBottom: "1px solid #333" }}>
                <td style={{ padding: 10 }}>{row.id}</td>
                <td style={{ padding: 10 }}>{row.meta?.teamNumber || "???"}</td>
                <td style={{ padding: 10 }}>
                  {row.meta?.matchNumber || "???"}
                </td>
                <td style={{ padding: 10 }}>{row.meta?.scoutName || "???"}</td>
                <td style={{ padding: 10 }}>{time}</td>
                <td style={{ padding: 10 }}>
<button 
  onClick={() => deleteItem(row.id)} 
  style={{ 
    backgroundColor: 'transparent',  // Light red background
    color: '#dc2626',            // Dark red icon color
    border: '1px solid #fca5a5',  // Soft red border
    padding: '8px',              // Equal padding around icon
    borderRadius: '4px',         // Rounded corners
    cursor: 'pointer'            // Pointer cursor on hover
  }}
>
  <FontAwesomeIcon icon={faTrash} />
</button>

                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
