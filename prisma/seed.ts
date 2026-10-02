/**
 * Demo data for Bella Books.
 *
 * Reproduces the reference screenshots closely enough to be a real regression
 * target: the seven September invoices from ref-04 sum to exactly the
 * ₹13,21,350.08 shown on that screen's summary card, and invoice 433 is a
 * genuine 18% GST invoice whose total lands on ₹2,06,743.08.
 *
 * Safe to re-run: it removes only the demo company it created.
 */
import { PrismaClient, TransactionType, StockReason, PaymentMode } from "@prisma/client";
import bcrypt from "bcryptjs";
import { provisionCompany } from "../server/services/provisioning";
import { postTransaction } from "../server/services/posting";
import { normalizeName } from "../lib/utils";
import { fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@bellabooks.test";
const DEMO_PASSWORD = "demo1234";
const COMPANY_NAME = "Bella Events";
const KERALA = "32";

/** IST midnight for a DD/MM/YYYY date, matching how the app stores dates. */
function ist(day: number, month: number, year: number): Date {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return fromZonedTime(`${year}-${mm}-${dd} 00:00:00`, "Asia/Kolkata");
}

const PARTIES: {
  name: string;
  gstType?: "REGISTERED" | "UNREGISTERED";
  gstin?: string;
  phone?: string;
  stateCode?: string;
}[] = [
  { name: "Thrissur district Sport's council", phone: "9847012345" },
  { name: "City Police Commissioner Thrissur", phone: "9847012346" },
  { name: "Aswin Alappuzha", phone: "9847012347" },
  { name: "secretary DTPC Thrissur", phone: "9847012348" },
  { name: "Secretary Amigos Club", phone: "9847012349" },
  { name: "SBI General Insurance Co. Ltd.", phone: "9847012350" },
  { name: "Dr. Niji Justin", phone: "9847012351" },
  { name: "Muhammad Hashim", phone: "9847012352" },
  { name: "Thrissur District Police Co-Operative", phone: "9847012353" },
  { name: "Banerji Memorial Club", phone: "9847012354" },
  { name: "SECRETARY REGENCY CLUB THRISSUR", phone: "9847012355" },
  { name: "VAIDYARATNAM OUSHADHASALA", phone: "9847012356" },
  { name: "Manorama.", phone: "9847012357" },
];

const SUPPLIERS = [
  { name: "Kerala Tent House", phone: "9847090001" },
  { name: "Thrissur Sound & Lights", phone: "9847090002" },
  { name: "Green Leaf Caterers", phone: "9847090003" },
];

/** Items from ref-03, including the negative quantities visible there. */
const ITEMS: { name: string; qty: number; sale: number; incl?: boolean; service?: boolean }[] = [
  { name: "(50 INCH ) LED TV", qty: 0, sale: 2500, incl: true },
  { name: "(Check the rates for LED wall)", qty: 0, sale: 0, service: true },
  { name: "(Chicken/ Fish)", qty: -150, sale: 220 },
  { name: "03.01.2025 Breakfast", qty: -20, sale: 90 },
  { name: "04.01.2025", qty: 0, sale: 0, service: true },
  { name: "04.01.2025 Breakfast", qty: -20, sale: 90 },
  { name: "04.01.2025 Lunch", qty: -130, sale: 180 },
  { name: "05.01.2025", qty: 0, sale: 0, service: true },
  { name: "1 for medical team", qty: 0, sale: 1500, service: true },
  { name: "1 for venue hydration point", qty: 0, sale: 1200, service: true },
  { name: "1 table (with cover)", qty: -1, sale: 350 },
  { name: "10 ft W * 50 - 100 mtrs of carpet", qty: 0, sale: 45 },
  { name: "10 nos in refreshment area", qty: 0, sale: 300 },
  { name: "10x10 Tent", qty: -3, sale: 4500 },
  { name: "Stage Setup (per day)", qty: 0, sale: 35000, service: true },
  { name: "Sound System (per day)", qty: 0, sale: 18000, service: true },
  { name: "LED Wall 12x8", qty: 4, sale: 65000 },
  { name: "Plastic Chair", qty: 480, sale: 35 },
  { name: "Round Table", qty: 40, sale: 250 },
  { name: "Generator 62 KVA", qty: 2, sale: 12000 },
];

/** Expense categories from ref-07, with the Direct/Indirect split (D-11). */
const EXPENSE_CATEGORIES: { name: string; type: "DIRECT" | "INDIRECT" }[] = [
  { name: "edwin photo grafer", type: "DIRECT" },
  { name: "EVENT EXPENSE", type: "DIRECT" },
  { name: "gopika welcom girl", type: "DIRECT" },
  { name: "murugan v pandal", type: "DIRECT" },
  { name: "stage abi (co) sanu", type: "DIRECT" },
];

/**
 * The seven September invoices from ref-04, in the order they appear.
 * `taxable` + 18% GST for 433; everything else is an exempt service, which is
 * what produces the round totals on that screen.
 */
const INVOICES: {
  number: string;
  party: string;
  date: Date;
  taxable: number;
  taxRate: number;
  paid?: number;
  item: string;
}[] = [
  { number: "428", party: "Manorama.", date: ist(3, 9, 2026), taxable: 11599, taxRate: 0, item: "Stage Setup (per day)" },
  { number: "429", party: "VAIDYARATNAM OUSHADHASALA", date: ist(4, 9, 2026), taxable: 4661, taxRate: 0, item: "Sound System (per day)" },
  { number: "430", party: "secretary DTPC Thrissur", date: ist(12, 9, 2026), taxable: 375000, taxRate: 0, item: "Stage Setup (per day)" },
  { number: "431", party: "secretary DTPC Thrissur", date: ist(12, 9, 2026), taxable: 358500, taxRate: 0, item: "Stage Setup (per day)" },
  { number: "432", party: "Thrissur district Sport's council", date: ist(19, 9, 2026), taxable: 2050, taxRate: 0, item: "Plastic Chair" },
  { number: "433", party: "SECRETARY REGENCY CLUB THRISSUR", date: ist(21, 9, 2026), taxable: 175206, taxRate: 18, item: "LED Wall 12x8" },
  { number: "434", party: "Banerji Memorial Club", date: ist(21, 9, 2026), taxable: 362797, taxRate: 0, paid: 150000, item: "Stage Setup (per day)" },
];

async function main() {
  console.log("Seeding Bella Books demo data…\n");

  // --- user ---------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: {
      email: DEMO_EMAIL,
      name: "Bella Events Owner",
      mobile: "9946050006",
      passwordHash,
    },
    select: { id: true },
  });
  console.log(`  user       ${DEMO_EMAIL}`);

  // Remove a previous run of this seed, and only that.
  const previous = await prisma.company.findFirst({
    where: { ownerId: user.id, name: COMPANY_NAME },
    select: { id: true },
  });
  if (previous) {
    await prisma.company.delete({ where: { id: previous.id } });
    console.log("  cleaned    previous demo company");
  }

  // --- company, firm, masters ---------------------------------------------
  const { companyId, firmId } = await prisma.$transaction((tx) =>
    provisionCompany(tx, {
      userId: user.id,
      companyName: COMPANY_NAME,
      gstin: null,
      stateCode: KERALA,
      addressLine1: "Ground Floor, Thiruvambady Devaswom",
      addressLine2: "Patthayappura Complex",
      city: "Thrissur",
      pincode: "680001",
      phone: "9946050006",
      email: "hello@bellaevents.example",
      fyStartMonth: 4,
      isGstEnabled: true,
    }),
  );
  console.log(`  company    ${COMPANY_NAME}`);

  const units = await prisma.unit.findMany({ where: { companyId }, select: { id: true, shortName: true } });
  const nos = units.find((u) => u.shortName === "NOS")!.id;

  const taxRates = await prisma.taxRate.findMany({
    where: { companyId },
    select: { id: true, name: true, rate: true },
  });
  const rateByPercent = new Map(
    taxRates.filter((t) => t.name.startsWith("GST @")).map((t) => [Number(t.rate), t.id]),
  );

  // --- parties ------------------------------------------------------------
  await prisma.party.createMany({
    data: [
      ...PARTIES.map((p) => ({
        companyId,
        name: p.name,
        nameNormalized: normalizeName(p.name),
        type: "CUSTOMER" as const,
        gstType: (p.gstType ?? "UNREGISTERED") as "REGISTERED" | "UNREGISTERED",
        gstin: p.gstin ?? null,
        stateCode: p.stateCode ?? KERALA,
        phone: p.phone ?? null,
      })),
      ...SUPPLIERS.map((s) => ({
        companyId,
        name: s.name,
        nameNormalized: normalizeName(s.name),
        type: "SUPPLIER" as const,
        gstType: "UNREGISTERED" as const,
        stateCode: KERALA,
        phone: s.phone,
      })),
    ],
  });
  const parties = await prisma.party.findMany({
    where: { companyId },
    select: { id: true, name: true },
  });
  const partyByName = new Map(parties.map((p) => [p.name, p.id]));
  console.log(`  parties    ${parties.length}`);

  // --- items --------------------------------------------------------------
  await prisma.item.createMany({
    data: ITEMS.map((i) => ({
      companyId,
      name: i.name,
      nameNormalized: normalizeName(i.name),
      type: i.service ? ("SERVICE" as const) : ("PRODUCT" as const),
      unitId: nos,
      salePrice: i.sale.toFixed(2),
      salePriceTaxInclusive: i.incl ?? false,
      purchasePrice: (i.sale * 0.7).toFixed(2),
      taxRateId: rateByPercent.get(0) ?? null,
      minStockQty: "5",
      hsnSac: i.service ? "998596" : "9403",
    })),
  });
  const items = await prisma.item.findMany({
    where: { companyId },
    select: { id: true, name: true, type: true },
  });
  const itemByName = new Map(items.map((i) => [i.name, i.id]));
  console.log(`  items      ${items.length}`);

  // Opening stock, so the quantities match ref-03 exactly — including the
  // negatives, which that screenshot shows because "Stop Sale on Negative
  // Stock" is off in ref-11.
  const movements = ITEMS.filter((i) => !i.service && i.qty !== 0).map((i) => ({
    companyId,
    itemId: itemByName.get(i.name)!,
    date: ist(1, 4, 2026),
    qtyIn: i.qty > 0 ? i.qty.toFixed(3) : "0",
    qtyOut: i.qty < 0 ? Math.abs(i.qty).toFixed(3) : "0",
    rate: (i.sale * 0.7).toFixed(2),
    reason: StockReason.OPENING,
    note: "Opening stock",
  }));
  if (movements.length > 0) await prisma.stockMovement.createMany({ data: movements });

  // --- expense categories --------------------------------------------------
  await prisma.expenseCategory.createMany({
    data: EXPENSE_CATEGORIES.map((c) => ({
      companyId,
      name: c.name,
      expenseType: c.type,
    })),
    skipDuplicates: true,
  });

  // --- bank account --------------------------------------------------------
  await prisma.bankAccount.create({
    data: {
      companyId,
      displayName: "Current Account",
      bankName: "State Bank of India",
      accountNumber: "34567890123",
      ifsc: "SBIN0070234",
      upiId: "bellaevents@sbi",
      openingBalance: "250000",
      openingAsOf: ist(1, 4, 2026),
    },
  });

  // --- invoices ------------------------------------------------------------
  const postingCtx = {
    companyId,
    firmId,
    userId: user.id,
    fyStartMonth: 4,
    stopSaleOnNegativeStock: false,
  };

  for (const inv of INVOICES) {
    await prisma.$transaction(async (tx) => {
      await postTransaction(tx, postingCtx, {
        type: TransactionType.SALE,
        date: inv.date,
        number: inv.number,
        partyId: partyByName.get(inv.party) ?? null,
        stateOfSupply: KERALA,
        isIgst: false,
        paymentMode: PaymentMode.CASH,
        paidAmount: inv.paid ? inv.paid.toFixed(2) : "0",
        lines: [
          {
            itemId: itemByName.get(inv.item) ?? null,
            hsnSac: "998596",
            qty: "1",
            unitId: nos,
            rate: inv.taxable.toFixed(2),
            rateIsTaxInclusive: false,
            taxRateId: rateByPercent.get(inv.taxRate) ?? null,
            taxRateValue: String(inv.taxRate),
          },
        ],
        terms: "Thanks for doing business with us.",
      });
    });
  }
  console.log(`  invoices   ${INVOICES.length} (Sep 2026, numbers 428-434)`);

  // --- verification --------------------------------------------------------
  const totals = await prisma.transaction.aggregate({
    where: { companyId, type: TransactionType.SALE, deletedAt: null },
    _sum: { total: true, paidAmount: true, balanceAmount: true },
  });

  const sum = totals._sum.total?.toFixed(2) ?? "0";
  const received = totals._sum.paidAmount?.toFixed(2) ?? "0";
  const balance = totals._sum.balanceAmount?.toFixed(2) ?? "0";

  console.log("\n  Sales total   ₹" + sum + "   (ref-04 shows 13,21,350.08)");
  console.log("  Received      ₹" + received + "   (ref-04 shows 1,50,000)");
  console.log("  Balance       ₹" + balance + "   (ref-04 shows 11,71,350.08)");

  if (sum !== "1321350.08") {
    throw new Error(`Seed mismatch: sales total is ${sum}, expected 1321350.08`);
  }

  // Ledger must balance: every debit has a matching credit.
  const ledger = await prisma.ledgerEntry.aggregate({
    where: { companyId },
    _sum: { debit: true, credit: true },
  });
  const debit = ledger._sum.debit?.toFixed(2) ?? "0";
  const credit = ledger._sum.credit?.toFixed(2) ?? "0";
  console.log(`\n  Ledger        debit ₹${debit} = credit ₹${credit}`);
  if (debit !== credit) {
    throw new Error(`Ledger does not balance: debit ${debit} vs credit ${credit}`);
  }

  console.log(`\nDone.\n  Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error("\nSeed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
