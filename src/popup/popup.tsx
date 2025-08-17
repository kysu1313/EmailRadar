import React, { useEffect, useState } from "react";

interface Email {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  important: boolean;
  reason?: string;
  _hidden?: boolean; // local only
}

interface Settings {
  darkMode: "auto" | "light" | "dark";
  batch: 10 | 20 | 30 | 50;
  defaultImportantOnly: boolean;
}

const loadSettings = (): Promise<Settings> =>
  new Promise((res) => {
    chrome.storage.sync.get(
      { darkMode: "auto", batch: 10, defaultImportantOnly: false } as Settings,
      (s) => res(s as Settings)
    );
  });
const saveSettings = (s: Partial<Settings>) => chrome.storage.sync.set(s);

export default function App() {
  const [tab, setTab] = useState<"inbox" | "settings">("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterImportant, setFilterImportant] = useState(false);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<Settings>({
    darkMode: "auto",
    batch: 10,
    defaultImportantOnly: false,
  });

  useEffect(() => {
    (async () => {
      const st = await loadSettings();
      setSettings(st);
      setFilterImportant(st.defaultImportantOnly);
      fetchEmails(st.batch);
    })();
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    if (
      settings.darkMode === "dark" ||
      (settings.darkMode === "auto" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
    }
  }, [settings.darkMode]);

  async function fetchEmails(count: number) {
    setLoading(true);
    chrome.runtime.sendMessage({ type: "GET_GMAIL", count }, (resp) => {
      if (resp?.success) {
        setEmails(resp.emails);
        setError(null);
      } else {
        setError(resp?.error || "Failed");
      }
      setLoading(false);
    });
  }

  function takeAction(id: string, type: "MARK_READ" | "MARK_SPAM") {
    chrome.runtime.sendMessage({ type, id }, () => {
      // hide & refill
      setEmails((curr) =>
        curr.map((e) => (e.id === id ? { ...e, _hidden: true } : e))
      );

      setTimeout(() => {
        chrome.runtime.sendMessage(
          { type: "GET_GMAIL", count: settings.batch },
          (resp) => {
            if (resp?.success) {
              setEmails((existing) => {
                const visible = existing.filter((e) => !e._hidden);
                const incoming = resp.emails.filter(
                  (ne: any) => !visible.some((v) => v.id === ne.id)
                );
                return [...visible, ...incoming].slice(0, settings.batch);
              });
            }
          }
        );
      }, 350);
    });
  }

  const filtered = emails
    .filter((e) =>
      search
        ? e.subject.toLowerCase().includes(search.toLowerCase()) ||
          e.from.toLowerCase().includes(search.toLowerCase()) ||
          e.reason?.toLowerCase().includes(search.toLowerCase())
        : true
    )
    .filter((e) => (filterImportant ? e.important : true));

  return (
    <div className="w-[420px] p-4 text-sm font-sans dark:bg-gray-900 dark:text-white space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 mb-1 items-center">
        {["inbox", "settings"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-3 py-1 border rounded ${
              tab === t
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
            title={t}
          >
            {t === "inbox" ? "Inbox" : "Settings"}
          </button>
        ))}
        <button
          onClick={() => fetchEmails(settings.batch)}
          className="px-2 py-1 border rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          title="Refresh"
        >
          🔄 Refresh
        </button>

        <div className="ml-auto flex-none">
          <img
            src="email-radar-full-logo.png"
            style={{ height: "100px" }}
            alt="Email Radar Logo"
          />
        </div>
      </div>

      {tab === "inbox" && (
        <>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border p-1 rounded dark:bg-gray-800"
            />
            <button
              className="px-2 py-1 bg-blue-500 text-white rounded"
              onClick={() => setFilterImportant((f) => !f)}
            >
              {filterImportant ? "Show All" : "Important Only"}
            </button>
          </div>

          {loading ? (
            <p className="animate-pulse">
              Loading<span className="animate-ping">...</span>
            </p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : filtered.length === 0 ? (
            <p>No emails</p>
          ) : (
            <div className="grid gap-2">
              {filtered.map((e) => (
                <div
                  key={e.id}
                  className={`transition-all duration-300 overflow-hidden ${
                    e._hidden
                      ? "opacity-0 max-h-0"
                      : "opacity-100 max-h-[400px]"
                  }`}
                >
                  <div className="p-3 border rounded bg-white dark:bg-gray-800 shadow">
                    {e.important && (
                      <div className="text-red-600 font-semibold">
                        ! {e.reason}
                      </div>
                    )}
                    <div className="font-medium">{e.subject}</div>
                    <div className="text-xs text-gray-600">{e.from}</div>
                    <div className="text-xs">{e.snippet}</div>
                    <div className="mt-2 flex gap-4">
                      <button
                        onClick={() => takeAction(e.id, "MARK_READ")}
                        className="px-3 py-1 rounded-full bg-[#00A878]/90 text-white hover:bg-[#00A878] transition"
                      >
                        Mark read
                      </button>
                      <button
                        onClick={() => takeAction(e.id, "MARK_SPAM")}
                        className="px-3 py-1 rounded-full bg-[#E63946]/90 text-white hover:bg-[#E63946] transition"
                      >
                        Spam
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "settings" && (
        <div className="space-y-3">
          <div>
            <label>Theme: </label>
            <select
              value={settings.darkMode}
              onChange={(e) => {
                const v = e.target.value as any;
                setSettings((s) => ({ ...s, darkMode: v }));
                saveSettings({ darkMode: v });
              }}
              className="border p-1 rounded w-full dark:bg-gray-800"
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div>
            <label>Batch size: </label>
            <select
              value={settings.batch}
              onChange={(e) => {
                const b = parseInt(e.target.value) as any;
                setSettings((s) => ({ ...s, batch: b }));
                saveSettings({ batch: b });
                fetchEmails(b);
              }}
              className="border p-1 rounded w-full dark:bg-gray-800"
            >
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>
              Important only by default:{" "}
              <input
                type="checkbox"
                checked={settings.defaultImportantOnly}
                onChange={(e) => {
                  const v = e.target.checked;
                  setSettings((s) => ({ ...s, defaultImportantOnly: v }));
                  saveSettings({ defaultImportantOnly: v });
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
