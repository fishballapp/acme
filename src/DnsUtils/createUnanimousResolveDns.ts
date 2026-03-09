import type { ResolveDnsFunction } from "./resolveDns.ts";

/**
 * Compose multiple DNS resolvers into one resolver that only returns records
 * visible across all configured resolvers.
 *
 * Each resolver is expected to return `[]` when a record is missing. Thrown
 * errors are propagated because unanimity cannot be determined reliably when a
 * resolver fails.
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
  const [firstRecords, ...remainingRecordss] = recordss;
  if (firstRecords === undefined) {
    return [];
  }

  let commonRecords = new Set(firstRecords);
  for (const records of remainingRecordss) {
    commonRecords = commonRecords.intersection(new Set(records));
    if (commonRecords.size === 0) {
      break;
    }
  }

  return [...commonRecords];
};
