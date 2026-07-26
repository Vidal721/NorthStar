import { useState, useEffect } from "react";

// Set your endpoints here for easy adjustment
const CLOUD_URL = "http://localhost:3000/match/Data";
const PI_URL = "http://192.168.1.100:8080/api"; // Replace with your Pi's static IP

export function useScoutData(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null); // Tracks if data came from Cloud or Pi
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Try the Cloud first
        const response = await fetch(`${CLOUD_URL}`);
        if (!response.ok) throw new Error("Cloud fetch failed");
        const json = await response.json();
        
        if (isMounted) {
          setData(json);
          console.log(json)
          setSource("cloud");
        }
      } catch (cloudError) {
        console.warn("Cloud failed, falling back to Pi...", cloudError);
        try {
          // 2. Fallback to the Raspberry Pi
          const piResponse = await fetch(`${PI_URL}${endpoint}`);
          if (!piResponse.ok) throw new Error("Pi fetch failed");
          const piJson = await piResponse.json();
          
          if (isMounted) {
            setData(piJson);
            setSource("pi");
          }
        } catch (piError) {
          if (isMounted) setError("Failed to fetch from both Cloud and Pi.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    
    // Optional: Add polling here if you want it to auto-refresh every X seconds

    return () => { isMounted = false; };
  }, [endpoint]);

  return { data, loading, source, error };
}