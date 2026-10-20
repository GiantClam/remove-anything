export const deletionRequestState = {
  limitSuccess: true,
  limitIdentifiers: [] as string[],
  sentEmails: [] as Array<Record<string, unknown>>,
  sendError: false,
  configured: true,
};

export class KVRateLimit {
  constructor(_client: unknown, _options: unknown) {}

  async limit(identifier: string) {
    deletionRequestState.limitIdentifiers.push(identifier);
    return { success: deletionRequestState.limitSuccess };
  }
}

export const kv = {};
export const env = {
  get SITE_NOTIFICATION_EMAIL_TO() {
    return deletionRequestState.configured ? "support@example.test" : undefined;
  },
  get NEXT_PUBLIC_SITE_EMAIL_FROM() {
    return deletionRequestState.configured
      ? "Remove Anything <noreply@example.test>"
      : "noreply@localhost";
  },
  RESEND_API_KEY: "resend-test-key",
};
export const resend = {
  emails: {
    async send(message: Record<string, unknown>) {
      deletionRequestState.sentEmails.push(message);
      return deletionRequestState.sendError
        ? { data: null, error: new Error("send failed") }
        : { data: { id: "email-test-id" }, error: null };
    },
  },
};

export function resetDeletionRequestState() {
  deletionRequestState.limitSuccess = true;
  deletionRequestState.limitIdentifiers = [];
  deletionRequestState.sentEmails = [];
  deletionRequestState.sendError = false;
  deletionRequestState.configured = true;
}
