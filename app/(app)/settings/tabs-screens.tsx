"use client";

import * as React from "react";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/forms/form-field";
import { SettingsForm, SettingsGroup, SettingToggle } from "./settings-form";
import type {
  TransactionSettings,
  PrintSettings,
  TaxSettings,
  PartySettings,
  ItemSettings,
  MessageSettings,
} from "@/lib/validators/settings";

/* ------------------------------ TRANSACTION ------------------------------- */

export function TransactionSettingsScreen({
  initial,
  canWrite,
  sequences,
}: {
  initial: TransactionSettings;
  canWrite: boolean;
  sequences: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <SettingsForm tab="transaction" initial={initial} canWrite={canWrite}>
        {(values, set) => (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="surface-card p-5">
              <SettingsGroup
                title="Invoice fields"
                description="Hide what you never use to keep the entry grid narrow."
              >
                <SettingToggle
                  id="showLineDiscount"
                  label="Discount on each line"
                  checked={values.showLineDiscount}
                  onChange={(v) => set("showLineDiscount", v)}
                />
                <SettingToggle
                  id="showBillDiscount"
                  label="Discount on the whole bill"
                  hint="Applied after line discounts and apportioned across lines before tax."
                  checked={values.showBillDiscount}
                  onChange={(v) => set("showBillDiscount", v)}
                />
                <SettingToggle
                  id="showFreeQuantity"
                  label="Free quantity"
                  hint="Goods delivered but not charged or taxed."
                  checked={values.showFreeQuantity}
                  onChange={(v) => set("showFreeQuantity", v)}
                />
                <SettingToggle
                  id="showLineDescription"
                  label="Description on each line"
                  checked={values.showLineDescription}
                  onChange={(v) => set("showLineDescription", v)}
                />
                <SettingToggle
                  id="showAdditionalCharges"
                  label="Additional charges"
                  hint="Shipping, packaging and the like, taxable or not."
                  checked={values.showAdditionalCharges}
                  onChange={(v) => set("showAdditionalCharges", v)}
                />
                <SettingToggle
                  id="defaultTaxInclusive"
                  label="New lines are tax-inclusive by default"
                  checked={values.defaultTaxInclusive}
                  onChange={(v) => set("defaultTaxInclusive", v)}
                />
              </SettingsGroup>
            </div>

            <div className="surface-card p-5">
              <SettingsGroup title="Totals and terms">
                <SettingToggle
                  id="roundOffEnabled"
                  label="Round off to the nearest rupee"
                  hint="Shown as its own line on the invoice."
                  checked={values.roundOffEnabled}
                  onChange={(v) => set("roundOffEnabled", v)}
                >
                  <Field id="roundOffMode" label="Rounding">
                    <Select
                      value={values.roundOffMode}
                      onValueChange={(v) =>
                        set("roundOffMode", v as TransactionSettings["roundOffMode"])
                      }
                    >
                      <SelectTrigger id="roundOffMode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nearest">Nearest rupee</SelectItem>
                        <SelectItem value="up">Always up</SelectItem>
                        <SelectItem value="down">Always down</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </SettingToggle>

                <Field
                  id="defaultDueDays"
                  label="Default payment terms (days)"
                  hint="Sets the due date on a new invoice when the party has no terms of its own."
                >
                  <Input
                    id="defaultDueDays"
                    type="number"
                    min={0}
                    max={365}
                    value={values.defaultDueDays}
                    onChange={(e) => set("defaultDueDays", Number(e.target.value))}
                    className="w-28"
                  />
                </Field>

                <SettingToggle
                  id="resetNumberingYearly"
                  label="Restart numbering each financial year"
                  checked={values.resetNumberingYearly}
                  onChange={(v) => set("resetNumberingYearly", v)}
                />
              </SettingsGroup>
            </div>
          </div>
        )}
      </SettingsForm>

      {sequences}
    </div>
  );
}

/* --------------------------------- PRINT ---------------------------------- */

export function PrintSettingsScreen({
  initial,
  canWrite,
}: {
  initial: PrintSettings;
  canWrite: boolean;
}) {
  return (
    <SettingsForm tab="print" initial={initial} canWrite={canWrite}>
      {(values, set) => (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="surface-card p-5">
            <SettingsGroup title="Layout">
              <Field id="theme" label="Theme">
                <Select
                  value={values.theme}
                  onValueChange={(v) => set("theme", v as PrintSettings["theme"])}
                >
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic — bordered, traditional</SelectItem>
                    <SelectItem value="modern">Modern — airy, accent rule</SelectItem>
                    <SelectItem value="compact">Compact — fits more lines</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field id="paperSize" label="Paper size">
                <Select
                  value={values.paperSize}
                  onValueChange={(v) => set("paperSize", v as PrintSettings["paperSize"])}
                >
                  <SelectTrigger id="paperSize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A5">A5</SelectItem>
                    <SelectItem value="thermal80">Thermal 80mm</SelectItem>
                    <SelectItem value="thermal58">Thermal 58mm</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <SettingToggle
                id="showCopyLabel"
                label="Print a copy label"
                hint="Original, Duplicate or Triplicate."
                checked={values.showCopyLabel}
                onChange={(v) => set("showCopyLabel", v)}
              />
            </SettingsGroup>
          </div>

          <div className="surface-card p-5">
            <SettingsGroup title="What prints">
              <SettingToggle
                id="showLogo"
                label="Firm logo"
                checked={values.showLogo}
                onChange={(v) => set("showLogo", v)}
              />
              <SettingToggle
                id="showSignature"
                label="Signature image"
                checked={values.showSignature}
                onChange={(v) => set("showSignature", v)}
              />
              <SettingToggle
                id="showBankDetails"
                label="Bank details"
                checked={values.showBankDetails}
                onChange={(v) => set("showBankDetails", v)}
              />
              <SettingToggle
                id="showUpiQr"
                label="UPI payment QR"
                hint="Encodes the firm's UPI ID and the balance due."
                checked={values.showUpiQr}
                onChange={(v) => set("showUpiQr", v)}
              />
              <SettingToggle
                id="showTerms"
                label="Terms & conditions"
                checked={values.showTerms}
                onChange={(v) => set("showTerms", v)}
              />
              <SettingToggle
                id="showAmountInWords"
                label="Amount in words"
                checked={values.showAmountInWords}
                onChange={(v) => set("showAmountInWords", v)}
              />
              <SettingToggle
                id="showHsnSummary"
                label="HSN / tax summary"
                checked={values.showHsnSummary}
                onChange={(v) => set("showHsnSummary", v)}
              />
              <SettingToggle
                id="showPartyBalance"
                label="Party balance"
                checked={values.showPartyBalance}
                onChange={(v) => set("showPartyBalance", v)}
              />
            </SettingsGroup>
          </div>
        </div>
      )}
    </SettingsForm>
  );
}

/* ------------------------------ TAXES & GST -------------------------------- */

export function TaxSettingsScreen({
  initial,
  canWrite,
}: {
  initial: TaxSettings;
  canWrite: boolean;
}) {
  return (
    <SettingsForm tab="tax" initial={initial} canWrite={canWrite}>
      {(values, set) => (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="surface-card p-5">
            <SettingsGroup title="GST">
              <SettingToggle
                id="enableGst"
                label="Enable GST"
                hint="Turn off to issue invoices with no tax at all."
                checked={values.enableGst}
                onChange={(v) => set("enableGst", v)}
              >
                <SettingToggle
                  id="enableHsn"
                  label="HSN / SAC codes"
                  checked={values.enableHsn}
                  onChange={(v) => set("enableHsn", v)}
                />
                <SettingToggle
                  id="compositionScheme"
                  label="Composition scheme"
                  hint="Composition dealers cannot charge GST on their invoices."
                  checked={values.compositionScheme}
                  onChange={(v) => set("compositionScheme", v)}
                />
                <SettingToggle
                  id="enableCess"
                  label="Cess"
                  checked={values.enableCess}
                  onChange={(v) => set("enableCess", v)}
                />
                <SettingToggle
                  id="enableReverseCharge"
                  label="Reverse charge"
                  checked={values.enableReverseCharge}
                  onChange={(v) => set("enableReverseCharge", v)}
                />
              </SettingToggle>
            </SettingsGroup>
          </div>

          <div className="surface-card p-5">
            <SettingsGroup title="TCS">
              <SettingToggle
                id="enableTcs"
                label="Enable TCS"
                hint="Charged on taxable value plus tax."
                checked={values.enableTcs}
                onChange={(v) => set("enableTcs", v)}
              >
                <Field id="defaultTcsRate" label="Default TCS rate %">
                  <Input
                    id="defaultTcsRate"
                    inputMode="decimal"
                    value={values.defaultTcsRate}
                    onChange={(e) => set("defaultTcsRate", Number(e.target.value) || 0)}
                    className="w-28"
                  />
                </Field>
              </SettingToggle>
            </SettingsGroup>
          </div>
        </div>
      )}
    </SettingsForm>
  );
}

/* --------------------------------- PARTY ----------------------------------- */

export function PartySettingsScreen({
  initial,
  canWrite,
}: {
  initial: PartySettings;
  canWrite: boolean;
}) {
  return (
    <SettingsForm tab="party" initial={initial} canWrite={canWrite}>
      {(values, set) => (
        <div className="surface-card max-w-xl p-5">
          <SettingsGroup title="Party fields">
            <SettingToggle
              id="enablePartyGroups"
              label="Party groups"
              checked={values.enablePartyGroups}
              onChange={(v) => set("enablePartyGroups", v)}
            />
            <SettingToggle
              id="enableCreditLimit"
              label="Credit limit"
              checked={values.enableCreditLimit}
              onChange={(v) => set("enableCreditLimit", v)}
            />
            <SettingToggle
              id="enableShippingAddress"
              label="Shipping address"
              checked={values.enableShippingAddress}
              onChange={(v) => set("enableShippingAddress", v)}
            />
            <SettingToggle
              id="enablePaymentTerms"
              label="Payment terms"
              hint="Sets the due date on new invoices for that party."
              checked={values.enablePaymentTerms}
              onChange={(v) => set("enablePaymentTerms", v)}
            />
          </SettingsGroup>
        </div>
      )}
    </SettingsForm>
  );
}

/* ---------------------------------- ITEM ----------------------------------- */

export function ItemSettingsScreen({
  initial,
  canWrite,
}: {
  initial: ItemSettings;
  canWrite: boolean;
}) {
  return (
    <SettingsForm tab="item" initial={initial} canWrite={canWrite}>
      {(values, set) => (
        <div className="surface-card max-w-xl p-5">
          <SettingsGroup title="Item fields">
            <SettingToggle
              id="maintainStock"
              label="Maintain stock"
              hint="Turn off for a pure services business."
              checked={values.maintainStock}
              onChange={(v) => set("maintainStock", v)}
            >
              <SettingToggle
                id="enableLowStockAlert"
                label="Low stock alerts"
                checked={values.enableLowStockAlert}
                onChange={(v) => set("enableLowStockAlert", v)}
              />
            </SettingToggle>
            <SettingToggle
              id="enableUnits"
              label="Units"
              checked={values.enableUnits}
              onChange={(v) => set("enableUnits", v)}
            />
            <SettingToggle
              id="enableCategories"
              label="Categories"
              checked={values.enableCategories}
              onChange={(v) => set("enableCategories", v)}
            />
            <SettingToggle
              id="enableWholesalePrice"
              label="Wholesale price"
              checked={values.enableWholesalePrice}
              onChange={(v) => set("enableWholesalePrice", v)}
            />
            <SettingToggle
              id="enableItemCode"
              label="Item code / SKU"
              checked={values.enableItemCode}
              onChange={(v) => set("enableItemCode", v)}
            />
            <SettingToggle
              id="enableItemImages"
              label="Item images"
              checked={values.enableItemImages}
              onChange={(v) => set("enableItemImages", v)}
            />
          </SettingsGroup>
        </div>
      )}
    </SettingsForm>
  );
}

/* --------------------------- TRANSACTION MESSAGE --------------------------- */

const PLACEHOLDERS = "{party} {number} {amount} {balance} {date} {firm}";

export function MessageSettingsScreen({
  initial,
  canWrite,
}: {
  initial: MessageSettings;
  canWrite: boolean;
}) {
  return (
    <SettingsForm tab="message" initial={initial} canWrite={canWrite}>
      {(values, set) => (
        <div className="surface-card max-w-2xl p-5">
          <SettingsGroup
            title="Message templates"
            description={`Available placeholders: ${PLACEHOLDERS}`}
          >
            <SettingToggle
              id="sendOnSave"
              label="Offer to send a message after saving"
              checked={values.sendOnSave}
              onChange={(v) => set("sendOnSave", v)}
            />

            <Field id="saleTemplate" label="Sale invoice">
              <Textarea
                id="saleTemplate"
                rows={3}
                value={values.saleTemplate}
                onChange={(e) => set("saleTemplate", e.target.value)}
              />
            </Field>

            <Field id="paymentTemplate" label="Payment received">
              <Textarea
                id="paymentTemplate"
                rows={3}
                value={values.paymentTemplate}
                onChange={(e) => set("paymentTemplate", e.target.value)}
              />
            </Field>

            <Field id="reminderTemplate" label="Payment reminder">
              <Textarea
                id="reminderTemplate"
                rows={3}
                value={values.reminderTemplate}
                onChange={(e) => set("reminderTemplate", e.target.value)}
              />
            </Field>
          </SettingsGroup>
        </div>
      )}
    </SettingsForm>
  );
}
