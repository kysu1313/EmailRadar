import React, { useEffect, useState } from "react";

export default function OptionsPage() {
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    chrome.storage.sync.get(["openaiKey"], (result) => {
      if (result.openaiKey) setApiKey(result.openaiKey);
    });
  }, []);

  function save() {
    chrome.storage.sync.set({ openaiKey: apiKey }, () => {
      alert("Saved!");
    });
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 16, width: 400 }}>
      <h2>Email Radar – Options</h2>

      <label>OpenAI API Key</label>
      <br />
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        style={{ width: "100%", padding: 4, marginTop: 4 }}
      />
      <br />
      <button onClick={save} style={{ marginTop: 8 }}>
        Save
      </button>
    </div>
  );
}
