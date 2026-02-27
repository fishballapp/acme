import type { ResolveDnsFunction } from "./resolveDns.ts";

const DNS_RECORD_TYPES = {
  A: 1,
  NS: 2,
  TXT: 16,
  AAAA: 28,
} as const;

export type ResolveDnsFetchConfig = {
  endpoint?: string | URL;
};

const EXTRACT_QUOTED_TXT_CHUNK_PATTERN = /"((?:[^"\\]|\\.)*)"/g;

export const createResolveDnsFetch = (
  config: ResolveDnsFetchConfig = {},
): ResolveDnsFunction =>
  (async (query, recordType) => {
    const recordTypeCode = DNS_RECORD_TYPES[recordType];
    const url = new URL(config.endpoint ?? "https://dns.google/resolve");
    url.searchParams.set("name", query);
    url.searchParams.set("type", `${recordTypeCode}`);
    const response = await fetch(url, {
      headers: {
        Accept: "application/dns-json",
      },
    });

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
  }) as ResolveDnsFunction;

export const resolveDns = createResolveDnsFetch();

const parseTxtRecord = (value: string): string[] => {
  const chunks = [...value.matchAll(EXTRACT_QUOTED_TXT_CHUNK_PATTERN)].map((
    match,
  ) => match[1] ?? "");

  return chunks.length <= 0 ? [stripWrappingQuotes(value)] : chunks;
};

const stripWrappingQuotes = (value: string): string => {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
};
