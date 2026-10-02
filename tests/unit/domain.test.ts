import { describe, expect, it } from "vitest";
import { BEHAVIOUR } from "@/lib/txn/behaviour";
import { formatDocumentNumber } from "@/lib/numbering";
import {
  parseSettings,
  defaultSettings,
  navFeatureFlags,
  SETTINGS_TABS,
  schemaForTab,
} from "@/lib/validators/settings";
import { CONVERSIONS, TYPE_LABELS, isPurchaseSide } from "@/lib/validators/transaction";
import { permissionsFor, can, PERMISSIONS } from "@/lib/auth/permissions";
import {
  COMPANY_SCOPED_MODELS,
  SOFT_DELETE_MODELS,
  UNSCOPED_MODELS,
} from "@/lib/db/models";

describe("document behaviour table", () => {
  it("covers every transaction type", () => {
    const types = Object.keys(BEHAVIOUR);
    expect(types).toContain("SALE");
    expect(types).toContain("PURCHASE");
    expect(types).toContain("EXPENSE");
    expect(types.length).toBeGreaterThanOrEqual(15);
  });

  it("keeps estimates, proforma and orders off the books entirely", () => {
    for (const type of ["ESTIMATE", "PROFORMA", "SALE_ORDER", "PURCHASE_ORDER"] as const) {
      expect(BEHAVIOUR[type].ledger, `${type} must not post to the ledger`).toBe(false);
      expect(BEHAVIOUR[type].stock, `${type} must not move stock`).toBeNull();
    }
  });

  it("moves stock on a delivery challan but posts no ledger entry", () => {
    // Nothing is owed until the challan is invoiced.
    expect(BEHAVIOUR.DELIVERY_CHALLAN.stock).toBe("out");
    expect(BEHAVIOUR.DELIVERY_CHALLAN.ledger).toBe(false);
  });

  it("moves stock in opposite directions for a sale and its return", () => {
    expect(BEHAVIOUR.SALE.stock).toBe("out");
    expect(BEHAVIOUR.SALE_RETURN.stock).toBe("in");
    expect(BEHAVIOUR.PURCHASE.stock).toBe("in");
    expect(BEHAVIOUR.PURCHASE_RETURN.stock).toBe("out");
  });

  it("gives a sale and its return opposite party effects", () => {
    expect(BEHAVIOUR.SALE.partySign).toBe(1);
    expect(BEHAVIOUR.SALE_RETURN.partySign).toBe(-1);
    expect(BEHAVIOUR.PAYMENT_IN.partySign).toBe(-1);
    expect(BEHAVIOUR.PAYMENT_OUT.partySign).toBe(1);
  });
});

describe("document numbering", () => {
  it("renders a bare number when the prefix is empty", () => {
    // ref-04 shows invoices numbered 428-434 with no prefix at all (D-09).
    expect(formatDocumentNumber("", "432")).toBe("432");
  });

  it("renders a prefixed number", () => {
    expect(formatDocumentNumber("EST-", "7")).toBe("EST-7");
  });
});

describe("conversions", () => {
  it("allows the estimate chain the brief describes", () => {
    expect(CONVERSIONS.ESTIMATE).toContain("SALE_ORDER");
    expect(CONVERSIONS.ESTIMATE).toContain("SALE");
    expect(CONVERSIONS.SALE_ORDER).toContain("SALE");
    expect(CONVERSIONS.DELIVERY_CHALLAN).toContain("SALE");
    expect(CONVERSIONS.PURCHASE_ORDER).toContain("PURCHASE");
  });

  it("does not allow converting a finished invoice into anything", () => {
    expect(CONVERSIONS.SALE).toBeUndefined();
  });

  it("labels every transaction type", () => {
    for (const type of Object.keys(BEHAVIOUR)) {
      expect(TYPE_LABELS[type as keyof typeof TYPE_LABELS]).toBeTruthy();
    }
  });
});

describe("purchase-side classification", () => {
  it("puts the buying documents on the purchase side", () => {
    for (const type of ["PURCHASE", "PURCHASE_RETURN", "PURCHASE_ORDER", "PAYMENT_OUT", "EXPENSE"] as const) {
      expect(isPurchaseSide(type), `${type} is a purchase-side document`).toBe(true);
    }
  });

  it("leaves the selling documents on the sale side", () => {
    for (const type of ["SALE", "SALE_RETURN", "ESTIMATE", "SALE_ORDER", "PAYMENT_IN"] as const) {
      expect(isPurchaseSide(type), `${type} is a sale-side document`).toBe(false);
    }
  });
});

describe("settings", () => {
  it("fills in every default", () => {
    const settings = defaultSettings();
    expect(settings.general.enableEstimate).toBe(true);
    expect(settings.general.stopSaleOnNegativeStock).toBe(false); // matches ref-11
    expect(settings.general.auditTrail).toBe(true);
    expect(settings.transaction.roundOffEnabled).toBe(true);
    expect(settings.tax.enableGst).toBe(true);
  });

  it("survives a null row", () => {
    expect(() => parseSettings(null)).not.toThrow();
    expect(parseSettings(null).general.decimalPlaces).toBe(2);
  });

  it("fills gaps in a partially written blob rather than failing", () => {
    const parsed = parseSettings({
      general: { enablePasscode: true },
      transaction: {},
      print: {},
      tax: {},
      party: {},
      item: {},
      message: {},
    });

    expect(parsed.general.enablePasscode).toBe(true);
    expect(parsed.general.decimalPlaces).toBe(2);
  });

  it("falls back to defaults when a blob is the wrong shape entirely", () => {
    const parsed = parseSettings({
      general: "not an object",
      transaction: 42,
      print: null,
      tax: [],
      party: {},
      item: {},
      message: {},
    });

    expect(parsed.general.decimalPlaces).toBe(2);
    expect(parsed.transaction.roundOffMode).toBe("nearest");
  });

  it("has a schema for every tab", () => {
    for (const tab of SETTINGS_TABS) {
      expect(() => schemaForTab(tab)).not.toThrow();
      expect(schemaForTab(tab).safeParse({}).success).toBe(true);
    }
  });

  it("derives the nav flags the sidebar reads", () => {
    const flags = navFeatureFlags(defaultSettings());
    expect(flags.enableEstimate).toBe(true);
    expect(flags.enableFixedAssets).toBe(false);
  });
});

describe("permission matrix", () => {
  it("gives the owner everything", () => {
    expect(permissionsFor("OWNER")).toHaveLength(PERMISSIONS.length);
  });

  it("withholds company management from an admin", () => {
    expect(can("ADMIN", "company.manage")).toBe(false);
    expect(can("ADMIN", "settings.write")).toBe(true);
  });

  it("stops an accountant changing the item master", () => {
    expect(can("ACCOUNTANT", "item.read")).toBe(true);
    expect(can("ACCOUNTANT", "item.write")).toBe(false);
    expect(can("ACCOUNTANT", "settings.write")).toBe(false);
  });

  it("confines a salesman to the sale side and never lets them delete", () => {
    expect(can("SALESMAN", "sale.write")).toBe(true);
    expect(can("SALESMAN", "purchase.write")).toBe(false);
    expect(can("SALESMAN", "transaction.delete")).toBe(false);
    expect(can("SALESMAN", "report.gst")).toBe(false);
  });

  it("only ever grants permissions that exist", () => {
    for (const role of ["OWNER", "ADMIN", "ACCOUNTANT", "SALESMAN"] as const) {
      for (const permission of permissionsFor(role)) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });
});

describe("tenancy registry shape", () => {
  it("does not list a model in both registries", () => {
    const scoped = new Set<string>(COMPANY_SCOPED_MODELS);
    for (const name of UNSCOPED_MODELS) {
      // CompanyMember is the documented exception and lives only in UNSCOPED.
      expect(scoped.has(name), `${name} must not be in both registries`).toBe(false);
    }
  });

  it("registers Transaction as both scoped and soft-deletable", () => {
    expect(COMPANY_SCOPED_MODELS).toContain("Transaction");
    expect(SOFT_DELETE_MODELS).toContain("Transaction");
  });

  it("does not soft-delete the ledger, which cascades with its transaction", () => {
    expect(SOFT_DELETE_MODELS).not.toContain("LedgerEntry");
    expect(SOFT_DELETE_MODELS).not.toContain("StockMovement");
  });
});
