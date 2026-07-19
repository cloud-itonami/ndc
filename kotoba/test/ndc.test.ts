import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import { registerDrug, lookupByCode, listDrugs } from "../src/index.js";

describe("ndc kotoba", () => {
  let e: any;

  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:ndc.etzhayyim.com" });
  });

  describe("registerDrug", () => {
    it("registers a drug with NDC code", async () => {
      const result = await registerDrug(e, {
        ndc: "50111-0001-01",
        genericName: "Aspirin",
        dosageForm: "tablet",
        manufacturer: "Bayer",
      });

      expect(result.status).toBe("registered");
      expect(result.drugUri).toBeDefined();
      expect(result.did).toBeDefined();
      expect(result.ndc).toBe("50111000101");
    });

    it("registers a drug with ATC code", async () => {
      const result = await registerDrug(e, {
        atc: "N02BA01",
        genericName: "Acetylsalicylic acid",
      });

      expect(result.status).toBe("registered");
      expect(result.drugUri).toBeDefined();
      expect(result.did).toBeDefined();
      expect(result.atc).toBe("N02BA01");
    });

    it("rejects drug with missing both NDC and ATC", async () => {
      const result = await registerDrug(e, {
        genericName: "Some Drug",
        dosageForm: "capsule",
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("missingNdcOrAtc");
    });

    it("rejects drug with missing genericName", async () => {
      const result = await registerDrug(e, {
        ndc: "50111-0001-01",
        genericName: "",
        dosageForm: "tablet",
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("missingGenericName");
    });

    it("is idempotent on NDC code", async () => {
      const input = {
        ndc: "50111-0001-01",
        genericName: "Aspirin",
      };

      const first = await registerDrug(e, input);
      expect(first.status).toBe("registered");
      const firstUri = first.drugUri;

      const second = await registerDrug(e, input);
      expect(second.status).toBe("alreadyExists");
      expect(second.drugUri).toBe(firstUri);
    });
  });

  describe("lookupByCode", () => {
    beforeEach(async () => {
      await registerDrug(e, {
        ndc: "50111-0001-01",
        atc: "N02BA01",
        genericName: "Aspirin",
        dosageForm: "tablet",
        manufacturer: "Bayer",
      });
      await registerDrug(e, {
        ndc: "68788-9047-05",
        genericName: "Ibuprofen",
        dosageForm: "tablet",
      });
    });

    it("looks up drug by NDC code", async () => {
      const result = await lookupByCode(e, { ndc: "50111-0001-01" });

      expect(result.error).toBeUndefined();
      expect(result.drug).toBeDefined();
      expect(result.drug?.genericName).toBe("Aspirin");
      expect(result.drug?.dosageForm).toBe("tablet");
    });

    it("looks up drug by ATC code", async () => {
      const result = await lookupByCode(e, { atc: "N02BA01" });

      expect(result.error).toBeUndefined();
      expect(result.drug).toBeDefined();
      expect(result.drug?.genericName).toBe("Aspirin");
    });

    it("returns notFound for missing code", async () => {
      const result = await lookupByCode(e, { ndc: "99999-9999-99" });

      expect(result.error).toBe("notFound");
      expect(result.drug).toBeUndefined();
    });

    it("rejects lookup with missing both NDC and ATC", async () => {
      const result = await lookupByCode(e, {});

      expect(result.error).toBe("missingNdcOrAtc");
      expect(result.drug).toBeUndefined();
    });
  });

  describe("listDrugs", () => {
    beforeEach(async () => {
      await registerDrug(e, {
        ndc: "50111-0001-01",
        genericName: "Aspirin",
        dosageForm: "tablet",
        manufacturer: "Bayer",
      });
      await registerDrug(e, {
        ndc: "68788-9047-05",
        genericName: "Ibuprofen",
        dosageForm: "tablet",
        manufacturer: "Advil",
      });
      await registerDrug(e, {
        ndc: "12345-6789-10",
        genericName: "Acetaminophen",
        dosageForm: "capsule",
        manufacturer: "Tylenol",
      });
    });

    it("lists all drugs", async () => {
      const result = await listDrugs(e, {});

      expect(result.items.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it("filters drugs by dosageForm", async () => {
      const result = await listDrugs(e, { dosageForm: "tablet" });

      expect(result.items.length).toBe(2);
      expect(result.items.every((d) => d.dosageForm === "tablet")).toBe(true);
    });

    it("filters drugs by manufacturer", async () => {
      const result = await listDrugs(e, { manufacturer: "Bayer" });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.genericName).toBe("Aspirin");
    });

    it("respects limit parameter", async () => {
      const result = await listDrugs(e, { limit: 2 });

      expect(result.items.length).toBeLessThanOrEqual(2);
    });
  });
});
