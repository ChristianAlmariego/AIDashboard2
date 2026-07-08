import { useState } from "react";
import { parseAdoCsv } from "./utils/csvParser";
import UploadPanel from "./components/UploadPanel";
import Dashboard from "./components/Dashboard";
import "./App.css";

export default function App() {
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState(null);

  function handleData(text, name) {
    try {
      const parsed = parseAdoCsv(text);
      setData(parsed);
      setFileName(name);
      setError(null);
    } catch (e) {
      setError("Failed to parse CSV: " + e.message);
    }
  }

  function handleReset() {
    setData(null);
    setFileName("");
    setError(null);
  }

  if (!data) {
    return <UploadPanel onData={handleData} error={error} />;
  }

  return <Dashboard data={data} fileName={fileName} onReset={handleReset} />;
}
