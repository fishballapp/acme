import type { ResolveDnsFunction } from "./resolveDns.ts";

/**
 * Compose multiple DNS resolvers into one resolver that only returns records
 * visible across all configured resolvers.
 *
 * This is useful for conservative verification before submitting ACME
 * challenges.
 */
export const createUnanimousResolveDns = (
  resolveDnses: readonly ResolveDnsFunction[],
): ResolveDnsFunction => {
  if (resolveDnses.length <= 0) {
    throw new Error("Expected at least 1 resolver");
  }

  return async <R extends "A" | "AAAA" | "NS" | "TXT">(
    query: string,
    recordType: R,
  ): Promise<"TXT" extends R ? string[][] : string[]> => {
    if (recordType === "TXT") {
      const allRecordss = await Promise.all(
        resolveDnses.map((resolveDns) => resolveDns(query, "TXT")),
      );
      const joinedRecordss = allRecordss.map((records) =>
        records.map((chunks) => chunks.join(""))
      );

      const commonRecords = intersectAll(joinedRecordss);
      // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
      return commonRecords.map((record) => [record]) as any;
    }

    const allRecordss = await Promise.all(
      resolveDnses.map((resolveDns) =>
        resolveDns(query, recordType as "A" | "AAAA" | "NS")
      ),
    );
    const commonRecords = intersectAll(allRecordss);
    // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
    return commonRecords as any;
  };
};

const intersectAll = (recordss: readonly string[][]): string[] => {
  let commonRecords = deduplicate(recordss[0] ?? []);
  for (let i = 1; i < recordss.length; i++) {
    commonRecords = intersect(commonRecords, recordss[i] ?? []);
  }
  return commonRecords;
};

const intersect = (
  recordsA: readonly string[],
  recordsB: readonly string[],
): string[] => {
  const recordsBSet = new Set(recordsB);
  return deduplicate(recordsA.filter((record) => recordsBSet.has(record)));
};

const deduplicate = (records: readonly string[]): string[] => {
  return [...new Set(records)];
};
