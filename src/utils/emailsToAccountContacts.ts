export const emailsToAccountContacts = (emails: readonly string[]): string[] =>
  emails.map((email) => `mailto:${email}`);
