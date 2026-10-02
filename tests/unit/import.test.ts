import { describe, expect, it } from "vitest";
import {
  guessMapping,
  validateRows,
  partyRowSchema,
  itemRowSchema,
  PARTY_IMPORT,
  ITEM_IMPORT,
  specFor,
} from "@/server/services/import";

describe("guessMapping", () => {
  it("matches headers that differ only by case and punctuation", () => {
    const mapping = guessMapping(PARTY_IMPORT, [
      "Party Name",
      "PHONE",
      "gst_no",
      "Opening Balance",
    ]);

    expect(mapping.name).toBe("Party Name");
    expect(mapping.phone).toBe("PHONE");
    expect(mapping.gstin).toBe("gst_no");
    expect(mapping.openingBalance).toBe("Opening Balance");
  });

  it("matches the item aliases a real export tends to use", () => {
    const mapping = guessMapping(ITEM_IMPORT, [
      "Item Name",
      "Selling Price",
      "Cost Price",
      "GST Rate",
      "HSN Code",
    ]);

    expect(mapping.name).toBe("Item Name");
    expect(mapping.salePrice).toBe("Selling Price");
    expect(mapping.purchasePrice).toBe("Cost Price");
    expect(mapping.taxRate).toBe("GST Rate");
    expect(mapping.hsnSac).toBe("HSN Code");
  });

  it("never maps one column to two fields", () => {
    const mapping = guessMapping(ITEM_IMPORT, ["Name", "Name", "Price"]);
    const used = Object.values(mapping);
    expect(new Set(used).size).toBe(used.length);
  });

  it("leaves a field unmapped when nothing matches", () => {
    const mapping = guessMapping(PARTY_IMPORT, ["Column A", "Column B"]);
    expect(mapping.name).toBeUndefined();
  });
});

describe("specFor", () => {
  it("returns the right spec", () => {
    expect(specFor("parties").kind).toBe("parties");
    expect(specFor("items").kind).toBe("items");
  });

  it("marks the name column required on both", () => {
    for (const kind of ["parties", "items"] as const) {
      const nameField = specFor(kind).fields.find((f) => f.key === "name");
      expect(nameField?.required).toBe(true);
    }
  });
});

describe("partyRowSchema", () => {
  const mapping = {
    name: "Name",
    type: "Type",
    phone: "Phone",
    openingBalance: "Balance",
    openingBalanceType: "Dir",
  };

  it("accepts a minimal row and applies defaults", () => {
    const { valid, issues } = validateRows(
      partyRowSchema,
      [{ Name: "Banerji Memorial Club" }],
      mapping,
    );

    expect(issues).toEqual([]);
    expect(valid).toHaveLength(1);
    expect(valid[0]?.data.type).toBe("CUSTOMER");
    expect(valid[0]?.data.openingBalance).toBe("0");
    expect(valid[0]?.data.openingBalanceType).toBe("TO_RECEIVE");
  });

  it("rejects a row with no name and reports the row number", () => {
    const { valid, issues } = validateRows(partyRowSchema, [{ Name: "" }], mapping);

    expect(valid).toHaveLength(0);
    // Row 2: the header is row 1.
    expect(issues[0]?.row).toBe(2);
    expect(issues[0]?.field).toBe("name");
  });

  it("strips currency formatting from an opening balance", () => {
    const { valid } = validateRows(
      partyRowSchema,
      [{ Name: "A", Balance: "₹ 1,23,456.78" }],
      mapping,
    );
    expect(valid[0]?.data.openingBalance).toBe("123456.78");
  });

  it("normalises the balance direction", () => {
    const { valid } = validateRows(
      partyRowSchema,
      [{ Name: "A", Dir: "to pay" }],
      mapping,
    );
    expect(valid[0]?.data.openingBalanceType).toBe("TO_PAY");
  });

  it("rejects an unknown party type", () => {
    const { issues } = validateRows(partyRowSchema, [{ Name: "A", Type: "VENDOR" }], mapping);
    expect(issues.some((i) => i.field === "type")).toBe(true);
  });

  it("rejects a malformed email", () => {
    const { issues } = validateRows(
      partyRowSchema,
      [{ Name: "A", Email: "not-an-email" }],
      { ...mapping, email: "Email" },
    );
    expect(issues.some((i) => i.field === "email")).toBe(true);
  });

  it("keeps validating after a bad row rather than stopping", () => {
    const { valid, issues } = validateRows(
      partyRowSchema,
      [{ Name: "Good One" }, { Name: "" }, { Name: "Good Two" }],
      mapping,
    );

    expect(valid).toHaveLength(2);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.row).toBe(3);
  });
});

describe("itemRowSchema", () => {
  const mapping = {
    name: "Name",
    type: "Type",
    salePrice: "Sale",
    purchasePrice: "Cost",
    taxRate: "GST",
    hsnSac: "HSN",
    openingQty: "Stock",
  };

  it("accepts a product row", () => {
    const { valid, issues } = validateRows(
      itemRowSchema,
      [{ Name: "10x10 Tent", Sale: "4500", Cost: "3000", GST: "18", HSN: "9403", Stock: "10" }],
      mapping,
    );

    expect(issues).toEqual([]);
    expect(valid[0]?.data.type).toBe("PRODUCT");
    expect(valid[0]?.data.salePrice).toBe("4500");
    expect(valid[0]?.data.taxRate).toBe("18");
  });

  it("rejects a GST rate that is not a real slab", () => {
    const { issues } = validateRows(
      itemRowSchema,
      [{ Name: "A", GST: "17" }],
      mapping,
    );
    expect(issues.some((i) => i.field === "taxRate")).toBe(true);
  });

  it("accepts every real GST slab", () => {
    for (const rate of ["0", "0.25", "3", "5", "12", "18", "28"]) {
      const { issues } = validateRows(itemRowSchema, [{ Name: "A", GST: rate }], mapping);
      expect(issues, `rate ${rate} should be accepted`).toEqual([]);
    }
  });

  it("rejects an HSN that is not 4, 6 or 8 digits", () => {
    const { issues } = validateRows(itemRowSchema, [{ Name: "A", HSN: "12345" }], mapping);
    expect(issues.some((i) => i.field === "hsnSac")).toBe(true);
  });

  it("treats a blank numeric cell as zero", () => {
    const { valid } = validateRows(itemRowSchema, [{ Name: "A", Sale: "" }], mapping);
    expect(valid[0]?.data.salePrice).toBe("0");
  });

  it("uppercases the type so lower-case sheets still import", () => {
    const { valid } = validateRows(itemRowSchema, [{ Name: "A", Type: "service" }], mapping);
    expect(valid[0]?.data.type).toBe("SERVICE");
  });
});
