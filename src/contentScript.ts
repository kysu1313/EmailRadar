
interface EmailSummary {
  id: string;
  subject: string;
  preview: string;
}

// Track what emails we've already sent to background
const sentIds = new Set<string>();

function extractEmail(el: Element): EmailSummary | null {
  const subjectEl = el.querySelector<HTMLElement>(".bog");
  const previewEl = el.querySelector<HTMLElement>(".y2");

  if (!subjectEl || !previewEl) return null;

  const id = (el as HTMLElement).dataset.threadId || subjectEl.innerText;
  const subject = subjectEl.innerText.trim();
  const preview = previewEl.innerText.trim();

  return { id, subject, preview };
}

// Send to background for classification
function sendForClassification(email: EmailSummary) {
  chrome.runtime.sendMessage(
    {
      type: "NEW_EMAIL",
      payload: {
        subject: email.subject,
        preview: email.preview
      }
    },
    (response) => {
      console.log("Background resp:", response);
    }
  );
}

// Scan the visible inbox for unread emails
function scanInbox() {
  const rows = document.querySelectorAll("tr.zA.zE");
  rows.forEach((r) => {
    const email = extractEmail(r);
    if (email && !sentIds.has(email.id)) {
      sentIds.add(email.id);
      sendForClassification(email);
    }
  });
}

// Observe DOM changes (new emails loaded)
const observer = new MutationObserver(() => {
  scanInbox();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
