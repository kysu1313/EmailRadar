// background.ts

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

async function listUnreadEmails() {
  const token = await getGmailAuthToken();
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread newer_than:30d&maxResults=10",
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  const data = await response.json();
  return data.messages || [];
}

async function getEmailDetail(id: string, token: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await response.json();
  const headers = data.payload.headers || [];
  const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
  const from = headers.find((h: any) => h.name === "From")?.value || "";
  const snippet = data.snippet || "";
  return { id, subject, from, snippet };
}

async function getApiKey(): Promise<string | undefined> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["openaiKey"], (r) => resolve(r.openaiKey));
  });
}

async function classifyBatch(emails: any[]) {
  const key = await getApiKey();
  if (!key) throw new Error("No OpenAI key set");

  const prompt = `
You are an assistant that determines if emails are personally important.
Important = messages about bills, job leads, security alerts, or from close contacts.

Return JSON keyed by id like:
{ "xyz": { "important": true, "reason": "..." } }

Emails:
${emails
  .map(
    (e, i) =>
      `${e.id}) Subject: ${e.subject}\nFrom: ${e.from}\nSnippet: ${e.snippet}\n`
  )
  .join("\n")}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

function sendNotification(e: any) {
  chrome.notifications.create(e.id, {
    type: "basic",
    iconUrl: "icon128.png",
    title: `Important Email: ${e.subject}`,
    message: e.reason
  });
}

// avoid notifying twice
async function markNotified(id: string) {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ [id]: true }, () => resolve());
  });
}
async function wasNotified(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get([id], (r) => resolve(!!r[id]));
  });
}

// Main handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_GMAIL") {
    (async () => {
      const messages = await listUnreadEmails();
      const token = await getGmailAuthToken();
      const details = [];
      for (const m of messages) {
        details.push(await getEmailDetail(m.id, token));
      }

      const results = await classifyBatch(details);

      // Attach classification
      for (const email of details) {
        const r = results[email.id];
        email.important = r?.important || false;
        email.reason = r?.reason || "";
        if (email.important && !(await wasNotified(email.id))) {
          sendNotification(email);
          await markNotified(email.id);
        }
      }

      sendResponse({ success: true, emails: details });
    })().catch((err) => {
      console.error(err);
      sendResponse({ success: false, error: String(err) });
    });
    return true; // async
  }
});
