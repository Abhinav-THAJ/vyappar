import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  COMPANY_SCOPED_MODELS,
  SOFT_DELETE_MODELS,
  UNSCOPED_MODELS,
  UNSCOPED_WITH_COMPANY_ID,
} from "@/lib/db/models";

interface ParsedModel {
  name: string;
  body: string;
  fields: string[];
}

function parseSchema(): ParsedModel[] {
  const schema = readFileSync(
    path.resolve(__dirname, "../../prisma/schema.prisma"),
    "utf8",
  );

  const models: ParsedModel[] = [];
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let match: RegExpExecArray | null;

  while ((match = re.exec(schema)) !== null) {
    const name = match[1]!;
    const body = match[2]!;
    const fields = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
      .map((l) => l.split(/\s+/)[0]!)
      .filter(Boolean);
    models.push({ name, body, fields });
  }

  return models;
}

const models = parseSchema();
const scoped = new Set<string>(COMPANY_SCOPED_MODELS);
const soft = new Set<string>(SOFT_DELETE_MODELS);
const unscoped = new Set<string>(UNSCOPED_MODELS);

describe("schema parsing", () => {
  it("finds every model", () => {
    expect(models.length).toBeGreaterThan(20);
    expect(models.map((m) => m.name)).toContain("Transaction");
    expect(models.map((m) => m.name)).toContain("Company");
  });
});

describe("tenancy registry matches the schema", () => {
  it("classifies every model exactly once", () => {
    for (const model of models) {
      const inScoped = scoped.has(model.name);
      const inUnscoped = unscoped.has(model.name);
      expect(
        inScoped || inUnscoped,
        `Model "${model.name}" is not classified in lib/db/models.ts. ` +
          `Add it to COMPANY_SCOPED_MODELS or UNSCOPED_MODELS.`,
      ).toBe(true);
      expect(
        inScoped && inUnscoped,
        `Model "${model.name}" is in both registries.`,
      ).toBe(false);
    }
  });

  it("scopes every model that has a companyId column", () => {
    const exceptions = new Set<string>(UNSCOPED_WITH_COMPANY_ID);
    for (const model of models) {
      const hasCompanyId = model.fields.includes("companyId");
      if (hasCompanyId && !exceptions.has(model.name)) {
        expect(
          scoped.has(model.name),
          `Model "${model.name}" has companyId but is not in COMPANY_SCOPED_MODELS — ` +
            `queries against it would not be tenant-scoped. If that is deliberate, ` +
            `add it to UNSCOPED_WITH_COMPANY_ID with a written justification.`,
        ).toBe(true);
      }
    }
  });

  it("keeps the unscoped-with-companyId exception list minimal and justified", () => {
    // CompanyMember is the membership table consulted to resolve access, so
    // scoping it by the active company would be circular. Nothing else qualifies
    // today; a new entry here should be a deliberate, reviewed decision.
    expect(UNSCOPED_WITH_COMPANY_ID).toEqual(["CompanyMember"]);
    for (const name of UNSCOPED_WITH_COMPANY_ID) {
      expect(unscoped.has(name), `"${name}" must also appear in UNSCOPED_MODELS.`).toBe(true);
    }
  });

  it("does not claim to scope a model that has no companyId", () => {
    for (const name of COMPANY_SCOPED_MODELS) {
      const model = models.find((m) => m.name === name);
      expect(model, `COMPANY_SCOPED_MODELS lists "${name}", which is not in the schema.`).toBeDefined();
      expect(
        model!.fields.includes("companyId"),
        `Model "${name}" is registered as scoped but has no companyId column.`,
      ).toBe(true);
    }
  });

  it("registers every soft-deletable model", () => {
    for (const model of models) {
      if (model.fields.includes("deletedAt")) {
        expect(
          soft.has(model.name),
          `Model "${model.name}" has deletedAt but is not in SOFT_DELETE_MODELS, ` +
            `so deleted rows would appear in normal reads.`,
        ).toBe(true);
      }
    }
    for (const name of SOFT_DELETE_MODELS) {
      const model = models.find((m) => m.name === name);
      expect(model?.fields.includes("deletedAt"), `"${name}" has no deletedAt column.`).toBe(true);
    }
  });
});

describe("two-level tenancy invariants (D-20)", () => {
  it("makes Transaction.firmId required", () => {
    const txn = models.find((m) => m.name === "Transaction")!;
    const firmLine = txn.body
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("firmId"));

    expect(firmLine).toBeDefined();
    expect(
      firmLine!.includes("String?"),
      "Transaction.firmId must be non-null: every transaction belongs to exactly one firm.",
    ).toBe(false);
  });

  it("keeps masters at company level, with no firmId", () => {
    // Parties and items are shared across the firms of a company — this is the
    // inference from the All Firms filter being absent on ref-02 and ref-03.
    for (const name of ["Party", "Item", "Unit", "ItemCategory", "PartyGroup"]) {
      const model = models.find((m) => m.name === name)!;
      expect(
        model.fields.includes("firmId"),
        `Master "${name}" must not carry firmId — masters are shared across firms.`,
      ).toBe(false);
    }
  });

  it("keys the invoice-number constraint on firm, not company", () => {
    const txn = models.find((m) => m.name === "Transaction")!;
    expect(txn.body).toContain("@@unique([firmId, type, financialYear, number])");
  });

  it("keys NumberSequence per firm so each firm runs its own series", () => {
    const seq = models.find((m) => m.name === "NumberSequence")!;
    expect(seq.body).toContain("@@unique([firmId, type, financialYear])");
  });

  it("gives Firm a companyId so firms cannot span companies", () => {
    const firm = models.find((m) => m.name === "Firm")!;
    expect(firm.fields).toContain("companyId");
  });
});

describe("money and quantity precision", () => {
  it("stores every money column at Decimal(14,2)", () => {
    const offenders: string[] = [];
    for (const model of models) {
      for (const raw of model.body.split("\n")) {
        const l = raw.trim();
        if (!l.includes("Decimal")) continue;
        if (l.startsWith("//")) continue;
        const hasScale = /@db\.Decimal\(14,\s*(2|3)\)|@db\.Decimal\(6,\s*3\)/.test(l);
        if (!hasScale) offenders.push(`${model.name}.${l.split(/\s+/)[0]}`);
      }
    }
    expect(offenders, `Decimal columns without an explicit precision: ${offenders.join(", ")}`).toEqual(
      [],
    );
  });

  it("never uses Float for money", () => {
    for (const model of models) {
      expect(
        /\bFloat\b/.test(model.body),
        `Model "${model.name}" uses Float — currency must never be a binary float.`,
      ).toBe(false);
    }
  });
});
