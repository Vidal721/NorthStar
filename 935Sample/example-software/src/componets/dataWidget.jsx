import { useScoutData } from "./useScoutData";

export default function DataWidget({ config }) {
  // config expects: { title, endpoint, type, dataMapping }
  const { data, loading, source, error } = useScoutData(config.endpoint);

  if (loading) return <div style={{ padding: "20px" }}>Loading {config.title}...</div>;
  if (error) return <div style={{ padding: "20px", color: "red" }}>{error}</div>;
  if (!data) return <div style={{ padding: "20px" }}>No data available.</div>;

  const renderContent = () => {
    switch (config.type) {
      case "leaderboard":
        // Assuming data is an array of objects
        return (
          <ol style={{ paddingLeft: "20px" }}>
            {data.slice(0, 5).map((item, index) => (
              <li key={index} style={{ marginBottom: "8px", fontWeight: index === 0 ? "bold" : "normal" }}>
                {/* Dynamically access data using your mapping */}
                Fit Score: {item.fitScore} {/*item[config.dataMapping.score]*/}
              </li>
            ))}
          </ol>
        );

      case "table":
        return (
          <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #eee" }}>
                <th>Team Number</th>
                <th>Match Number</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index}>
                  <td style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>{item.meta.teamNumber}</td>
                  <td style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>{item.meta.matchNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case "metric":
      default:
        return (
          <div>
            <h1 style={{ fontSize: "2.5rem", margin: "0 0 10px 0" }}>
              Metrics
            </h1>
          </div>
        );
    }
  };

  return (
    <div style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflow: "auto" }}>
        {renderContent()}
      </div>
      {/* Little indicator to show where the data came from */}
      <div style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "right", marginTop: "10px" }}>
        Live via: {source === "cloud" ? "☁️ Cloud" : "🍓 Pi"}
      </div>
    </div>
  );
}