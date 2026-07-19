/**
 * ndc kotoba — record types.
 *
 * Per ADR-2605203000 Option B (PDS XRPC). NDC = US FDA National Drug
 * Code. Also indexes WHO ATC code for cross-jurisdiction lookup.
 *
 * Identity hierarchy:
 *   did:web:ndc.etzhayyim.com                       — controller
 *   did:web:ndc.etzhayyim.com:drug:{ndc}            — Drug (NDC-keyed)
 *   did:web:ndc.etzhayyim.com:atc:{atc}             — Drug (ATC-keyed alias)
 */

export const NDC_DID_PREFIX = "did:web:ndc.etzhayyim.com:" as const;

export interface DrugRecord {
  did: string;
  /** US FDA NDC code (11-digit normalized: 5-4-2). */
  ndc?: string;
  /** WHO ATC code (5-7 chars, anatomical-therapeutic-chemical). */
  atc?: string;
  /** Defined Daily Dose (mg). */
  dddMg?: number;
  genericName: string;
  brandName?: string;
  dosageForm?: string;
  routeOfAdministration?: string;
  manufacturer?: string;
  createdAt: string;
}

export interface DrugView extends DrugRecord {
  drugUri: string;
}

export interface RegisterDrugInput {
  ndc?: string;
  atc?: string;
  dddMg?: number;
  genericName: string;
  brandName?: string;
  dosageForm?: string;
  routeOfAdministration?: string;
  manufacturer?: string;
}

export interface RegisterDrugOutput {
  status: "registered" | "alreadyExists" | "rejected";
  drugUri?: string;
  did?: string;
  ndc?: string;
  atc?: string;
  error?: string;
}

export interface LookupByCodeInput {
  ndc?: string;
  atc?: string;
}

export interface LookupByCodeOutput {
  drug?: DrugView;
  error?: string;
}

export interface ListDrugsInput {
  dosageForm?: string;
  manufacturer?: string;
  limit?: number;
  cursor?: string;
}

export interface ListDrugsOutput {
  items: DrugView[];
  cursor?: string;
  total: number;
}

export function ndcKey(ndc: string): string {
  return ndc.replace(/[^0-9]/g, "");
}

export function drugRkeyByNdc(ndc: string): string {
  return `drug-ndc-${ndcKey(ndc)}`;
}

export function drugRkeyByAtc(atc: string): string {
  return `drug-atc-${atc.toLowerCase()}`;
}

export function drugDidByNdc(ndc: string): string {
  return `${NDC_DID_PREFIX}drug:${ndcKey(ndc)}`;
}

export function drugDidByAtc(atc: string): string {
  return `${NDC_DID_PREFIX}atc:${atc.toLowerCase()}`;
}
