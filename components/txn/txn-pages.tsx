import type { TransactionType } from "@prisma/client";
import {
  loadTransactionFormData,
  loadTransactionDefaults,
} from "@/server/services/txn-form-data";
import { TransactionForm } from "./transaction-form";

/**
 * Shared page bodies for every goods document, so the per-type routes stay
 * thin and the behaviour cannot drift between Sale, Purchase, Estimate and the
 * rest.
 */

export async function NewTransactionPage({
  type,
  duplicateOf,
  convertedFromId,
}: {
  type: TransactionType;
  duplicateOf?: string;
  convertedFromId?: string;
}) {
  const { ctx, firms, units, taxRates, settings, firmStateCode } =
    await loadTransactionFormData();

  const defaults = duplicateOf
    ? await loadTransactionDefaults(ctx.companyId, duplicateOf, { asDuplicate: true })
    : undefined;

  return (
    <TransactionForm
      type={type}
      firms={firms}
      activeFirmId={ctx.firmId}
      units={units}
      taxRates={taxRates}
      settings={settings}
      firmStateCode={firmStateCode}
      defaults={defaults ? { ...defaults, convertedFromId } : { convertedFromId }}
    />
  );
}

export async function EditTransactionPage({
  type,
  id,
}: {
  type: TransactionType;
  id: string;
}) {
  const { ctx, firms, units, taxRates, settings, firmStateCode } =
    await loadTransactionFormData();

  const defaults = await loadTransactionDefaults(ctx.companyId, id);

  return (
    <TransactionForm
      type={type}
      firms={firms}
      activeFirmId={ctx.firmId}
      units={units}
      taxRates={taxRates}
      settings={settings}
      firmStateCode={firmStateCode}
      defaults={defaults}
    />
  );
}
