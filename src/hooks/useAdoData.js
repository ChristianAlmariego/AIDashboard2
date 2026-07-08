import { useState, useCallback } from "react";
import { fetchUserStories } from "../api/ado";

export function useAdoData() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async (pat) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserStories(pat);
      setStories(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stories, loading, error, lastRefresh, load };
}
