interface CachedEmails {
  cachedAt: number; // timestamp
  emails: any[];
}

async function getGmailAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        return reject(chrome.runtime.lastError);
      }
      resolve(token as string);
    });
  });
}

async function listUnreadEmailIds(count: number) {
  const token = await getGmailAuthToken();
  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread newer_than:30d&maxResults=${count}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  return data.messages?.map((m: any) => m.id) || [];
}

async function getEmailDetail(id: string, token: string) {
  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  const headers = data.payload.headers || [];
  const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
  const from = headers.find((h: any) => h.name === "From")?.value || "";
  const snippet = data.snippet || "";
  return { id, subject, from, snippet };
}

async function classifyBatch(emails: any[]) {
  const key = await getApiKey();
  if (!key) throw new Error("No OpenAI key");

  
const includeSnippet = await new Promise(r => chrome.storage.sync.get(
  ["useSnippet"], v => r(!!v.useSnippet)
));

  const prompt = `
You determine if emails are personally important based on:
- bills, job leads, security alerts, or if from close contacts

Return JSON keyed by id like:
{ "XYZ": {"important": true, "reason":"..."} }

Emails:
${emails.map(e => {
  const base = `${e.id}) Subject: ${e.subject}\nFrom: ${e.from}\n`;
  return includeSnippet ? base + `Snippet: ${e.snippet}\n` : base;
}).join("")}
`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });
  const data = await resp.json();
  return JSON.parse(data.choices[0].message.content);
}

async function getApiKey(): Promise<string | undefined> {
  return new Promise((resolve) =>
    chrome.storage.sync.get(["openaiKey"], (r) => resolve(r.openaiKey))
  );
}

async function wasNotified(id: string) {
  return new Promise((res) =>
    chrome.storage.local.get([id], (x) => res(!!x[id]))
  );
}
async function markNotified(id: string) {
  chrome.storage.local.set({ [id]: true });
}

function sendNoti(e: any) {
  chrome.notifications.create(e.id, {
    type: "basic",
    iconUrl: "icon128.png",
    title: `Important: ${e.subject}`,
    message: e.reason,
  });
}

function loadCache(): Promise<CachedEmails | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["cachedEmails"], (r) => {
      resolve(r.cachedEmails || null);
    });
  });
}
function saveCache(cache: CachedEmails) {
  chrome.storage.local.set({ cachedEmails: cache });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_GMAIL") {
    (async () => {
      const { count } = msg;

      let cache = await loadCache();
      const now = Date.now();
      const maxAge = 6 * 60 * 60 * 1000; // 6h

      let cachedEmails: any[] = [];

      if (cache && now - cache.cachedAt < maxAge) {
        cachedEmails = cache.emails;
      }

      const existingIds = new Set(cachedEmails.map((e) => e.id));

      const unreadIds = await listUnreadEmailIds(count);
      const newIds = unreadIds.filter((id) => !existingIds.has(id));

      let newEmails: any[] = [];

      if (newIds.length) {
        const token = await getGmailAuthToken();
        for (const id of newIds) {
          newEmails.push(await getEmailDetail(id, token));
        }
        const gptRes = await classifyBatch(newEmails);
        newEmails = newEmails.map((e) => ({
          ...e,
          important: gptRes[e.id]?.important || false,
          reason: gptRes[e.id]?.reason || "",
        }));

        for (const e of newEmails) {
          if (e.important && !(await wasNotified(e.id))) {
            sendNoti(e);
            await markNotified(e.id);
          }
        }
        cachedEmails = [...newEmails, ...cachedEmails];

        if (cachedEmails.length > 200) {
          cachedEmails = cachedEmails.slice(0, 200);
        }
        cache = { cachedAt: now, emails: cachedEmails };
        saveCache(cache);
      }

      sendResponse({ success: true, emails: cachedEmails });
    })().catch((err) => {
      console.error(err);
      sendResponse({ success: false, error: String(err) });
    });

    return true;
  }

  if (msg.type === "MARK_READ") {
    gmailModify(msg.id, { removeLabelIds: ["UNREAD"] });
    sendResponse({ ok: true });
  }

  if (msg.type === "MARK_SPAM") {
    gmailModify(msg.id, { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] });
    sendResponse({ ok: true });
  }

  if (msg.type === "SET_ICON_IMPORTANCE") {
    const icon = msg.hasImportant
      ? {
          16: "email-radar-icon.png",
          32: "email-radar-icon.png",
          48: "email-radar-icon.png",
          128: "email-radar-icon.png",
        }
      : {
          16: "email-radar-icon-ni.png",
          32: "email-radar-icon-ni.png",
          48: "email-radar-icon-ni.png",
          128: "email-radar-icon-ni.png",
        };
    chrome.action.setIcon({ path: icon });
  }
});

async function gmailModify(id: string, mods: any) {
  const token = await getGmailAuthToken();
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mods),
    }
  );
}
