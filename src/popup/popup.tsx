import React, { useEffect, useState } from "react";

export default function App() {
  const [emails, setEmails] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_GMAIL" }, (resp) => {
      if (resp?.success) {
        setEmails(resp.emails);
      } else {
        setError(resp?.error || "Failed");
      }
    });
  }, []);

  return (
    <div style={{ padding: 8, fontFamily: "sans-serif", width: 350 }}>
      <h3>Unread Gmail (last 30d)</h3>
      {error ? (
        <p>Error: {error}</p>
      ) : emails.length === 0 ? (
        <p>No unread found</p>
      ) : (
        <ul>
          {emails.map((m) => (
            <li key={m.id} style={{ marginBottom: 10 }}>
              <strong>{m.subject}</strong> <br />
              From: {m.from} <br />
              {m.important ? (
                <span style={{ color: "red" }}>★ Important – {m.reason}</span>
              ) : (
                <span>not important</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
