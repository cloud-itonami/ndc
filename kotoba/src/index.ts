/**
 * ndc kotoba — barrel.
 *
 * Per ADR-2605203000 Option B Phase E reference impl. NDC drug code
 * registry — US FDA NDC + WHO ATC cross-jurisdiction lookup.
 *
 * Slice 1: 3 commands (covers 1 canonical vendor lexicon lookupByCode +
 * 2 helper registry functions).
 *   registerDrug + lookupByCode + listDrugs
 */

export * from "./types.js";
export { registerDrug, lookupByCode, listDrugs } from "./registry.js";
