import type { ResolveDnsFunction } from "./resolveDns.ts";

const DNS_RECORD_TYPES = {
  A: 1,
  NS: 2,
  TXT: 16,
  AAAA: 28,
} as const;

export const resolveDns: ResolveDnsFunction = async (
  query,
  recordType,
) => {
  const recordTypeCode = DNS_RECORD_TYPES[recordType];
  const response = await fetch(
    `https://dns.google/resolve?name=${
      encodeURIComponent(query)
    }&type=${recordTypeCode}`,
    {
      headers: {
        Accept: "application/dns-json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Cannot resolve DNS query. HTTP ${response.status}`);
  }

  const body = await response.json() as {
    Status?: number;
    Answer?: Array<{ type: number; data: string }>;
  };

  if (body.Status !== undefined && body.Status !== 0) {
    throw new Error(`Cannot resolve DNS query. Status ${body.Status}`);
  }

  const answers = (body.Answer ?? [])
    .filter((answer) => answer.type === recordTypeCode)
    .map((answer) => answer.data);

  if (recordType !== "TXT") {
    return answers;
  }

  return answers.map(parseTxtRecord);
};

const parseTxtRecord = (value: string): string[] => {
  const chunks = [...value.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((v) =>
    v[1] ?? ""
  );

  return chunks.length <= 0 ? [stripWrappingQuotes(value)] : chunks;
};

const stripWrappingQuotes = (value: string): string => {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
};
