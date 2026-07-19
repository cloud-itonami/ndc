/**
 * ndc kotoba — drug registry (slice 1, canonical complete).
 *
 *   registerDrug   — register a Drug record
 *                    Prefers NDC as primary key; falls back to ATC.
 *                    rkey=drug-ndc-{ndc} OR drug-atc-{atc-lower}
 *   lookupByCode   — lookup by NDC OR ATC code (canonical vendor lexicon)
 *   listDrugs      — cursor + dosageForm/manufacturer filter
 *
 * Vendor canonical lexicon (lookupByCode) is covered.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  drugDidByAtc,
  drugDidByNdc,
  drugRkeyByAtc,
  drugRkeyByNdc,
  ndcKey,
  type DrugRecord,
  type DrugView,
  type ListDrugsInput,
  type ListDrugsOutput,
  type LookupByCodeInput,
  type LookupByCodeOutput,
  type RegisterDrugInput,
  type RegisterDrugOutput,
} from "./types.js";

const DRUG_COLLECTION = "com.etzhayyim.ndc.drug";

export async function registerDrug(
  e: Etzhayyim,
  input: RegisterDrugInput
): Promise<RegisterDrugOutput> {
  if (!input.genericName) {
    return { status: "rejected", error: "missingGenericName" };
  }
  if (!input.ndc && !input.atc) {
    return { status: "rejected", error: "missingNdcOrAtc" };
  }

  // Primary key: NDC > ATC.
  const rkey = input.ndc ? drugRkeyByNdc(input.ndc) : drugRkeyByAtc(input.atc!);
  const did = input.ndc ? drugDidByNdc(input.ndc) : drugDidByAtc(input.atc!);

  const existing = await e
    .read<DrugRecord>({ collection: DRUG_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      drugUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      ndc: existing.records[0].value.ndc,
      atc: existing.records[0].value.atc,
    };
  }
  const now = new Date().toISOString();
  const record: DrugRecord = {
    did,
    ndc: input.ndc ? ndcKey(input.ndc) : undefined,
    atc: input.atc ? input.atc.toUpperCase() : undefined,
    dddMg: input.dddMg,
    genericName: input.genericName,
    brandName: input.brandName,
    dosageForm: input.dosageForm,
    routeOfAdministration: input.routeOfAdministration,
    manufacturer: input.manufacturer,
    createdAt: now,
  };
  const receipt = await e.write({
    collection: DRUG_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  // When both NDC and ATC are present, also index under the ATC rkey so
  // lookupByCode({ atc }) can resolve the same record without scanning.
  if (input.ndc && input.atc) {
    await e.write({
      collection: DRUG_COLLECTION,
      record: record as unknown as Record<string, unknown>,
      rkey: drugRkeyByAtc(input.atc),
    });
  }
  return {
    status: "registered",
    drugUri: receipt.uri,
    did,
    ndc: record.ndc,
    atc: record.atc,
  };
}

export async function lookupByCode(
  e: Etzhayyim,
  input: LookupByCodeInput
): Promise<LookupByCodeOutput> {
  if (!input.ndc && !input.atc) {
    return { error: "missingNdcOrAtc" };
  }
  // Try NDC first.
  if (input.ndc) {
    const resp = await e
      .read<DrugRecord>({
        collection: DRUG_COLLECTION,
        rkey: drugRkeyByNdc(input.ndc),
      })
      .catch(() => ({ records: [] }));
    const r = resp.records[0];
    if (r) {
      return { drug: { ...r.value, drugUri: r.uri } };
    }
  }
  // Fall back to ATC.
  if (input.atc) {
    const resp = await e
      .read<DrugRecord>({
        collection: DRUG_COLLECTION,
        rkey: drugRkeyByAtc(input.atc),
      })
      .catch(() => ({ records: [] }));
    const r = resp.records[0];
    if (r) {
      return { drug: { ...r.value, drugUri: r.uri } };
    }
  }
  return { error: "notFound" };
}

export async function listDrugs(
  e: Etzhayyim,
  input: ListDrugsInput = {}
): Promise<ListDrugsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<DrugRecord>({
    collection: DRUG_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: DrugView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.dosageForm && v.dosageForm !== input.dosageForm) return false;
      if (input.manufacturer && v.manufacturer !== input.manufacturer) {
        return false;
      }
      return true;
    })
    .map((r) => ({ ...r.value, drugUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}
