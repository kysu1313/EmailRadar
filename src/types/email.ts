export interface EmailSummary {
  id: string;
  subject: string;
  preview: string;
}

export interface ClassifiedEmail {
  subject: string;
  important: boolean;
  reason?: string;
}
