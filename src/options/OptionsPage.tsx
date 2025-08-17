import React, { useEffect, useState } from "react";

export default function OptionsPage() {
  const [apiKey, setApiKey] = useState("");
  const [useSnippet, setUseSnippet] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(["openaiKey"], (r) => {
      if (r.openaiKey) setApiKey(r.openaiKey);
      setUseSnippet(!!r.useSnippet);
    });
  }, []);

  function save() {
    chrome.storage.sync.set({ openaiKey: apiKey }, () => {
      alert("Saved!");
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 dark:text-white">
      <div className="w-full max-w-md space-y-6 bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg">
        <img
          src="email-radar-full-logo.png"
          alt="Email Radar Logo"
          className="mx-auto mb-4 h-[100px] w-[100px]"
        />
        <h2
          className="text-2xl font-bold text-center"
          style={{ marginTop: "-30px" }}
        >
          EmailRadar Settings
        </h2>

        <div className="space-y-2">
          <label className="font-medium">OpenAI API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700"
            placeholder="sk-..."
          />
        </div>

        <div className="space-y-2">
          <label className="font-medium flex items-center gap-2">
            Include snippet in AI classification
            <span
              className="inline-flex items-center justify-center min-w-[18px] min-h-[18px] rounded-full border text-[10px] leading-none cursor-help"
              title="Disabled by default. Enabling allows a small preview of the email body to be sent to ChatGPT for better classification results."
            >
              i
            </span>
          </label>
          <input
            type="checkbox"
            checked={useSnippet}
            onChange={(e) => {
              const v = e.target.checked;
              setUseSnippet(v);
              chrome.storage.sync.set({ useSnippet: v });
            }}
          />
        </div>

        <button
          onClick={save}
          className="w-full py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Save
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          Your API key is stored locally and securely in your browser. It is used to classify
          emails for importance.
        </p>
      </div>
    </div>
  );
}
