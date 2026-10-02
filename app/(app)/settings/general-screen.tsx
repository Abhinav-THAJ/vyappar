"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Check, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge, InfoHint } from "@/components/ui/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/forms/form-field";
import { SettingsForm, SettingsGroup, SettingToggle } from "./settings-form";
import { formatDateTime } from "@/lib/format/date";
import { saveCompanyProfileAction } from "@/server/actions/settings";
import type { GeneralSettings } from "@/lib/validators/settings";
import { cn } from "@/lib/utils";

const ZOOM_STOPS = [70, 80, 90, 100, 110, 120, 130];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The GENERAL tab, laid out in the three columns of ref-11. */
export function GeneralSettingsScreen({
  initial,
  company,
  firms,
  lastBackupAt,
  canWrite,
  canManageCompany,
}: {
  initial: GeneralSettings;
  company: { name: string; fyStartMonth: number; isGstEnabled: boolean; isMultiFirm: boolean };
  firms: { id: string; name: string; isDefault: boolean; gstin: string | null }[];
  lastBackupAt: string | null;
  canWrite: boolean;
  canManageCompany: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = React.useState(company);
  const [savingProfile, setSavingProfile] = React.useState(false);

  const profileDirty = JSON.stringify(profile) !== JSON.stringify(company);

  async function saveProfile() {
    setSavingProfile(true);
    const result = await saveCompanyProfileAction(profile);
    setSavingProfile(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Company updated");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Company profile */}
      <div className="surface-card p-5">
        <SettingsGroup title="Company">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="companyName" label="Company name" required>
              <Input
                id="companyName"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                disabled={!canManageCompany}
              />
            </Field>

            <Field
              id="fyStartMonth"
              label="Financial year starts in"
              hint="Drives numbering resets and every report."
            >
              <Select
                value={String(profile.fyStartMonth)}
                onValueChange={(v) => setProfile((p) => ({ ...p, fyStartMonth: Number(v) }))}
                disabled={!canManageCompany}
              >
                <SelectTrigger id="fyStartMonth">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={profile.isGstEnabled}
                onChange={(e) => setProfile((p) => ({ ...p, isGstEnabled: e.target.checked }))}
                disabled={!canManageCompany}
                className="size-[18px] accent-[var(--color-brand-600)]"
              />
              <span className="text-sm">This company is GST registered</span>
            </label>

            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={profile.isMultiFirm}
                onChange={(e) => setProfile((p) => ({ ...p, isMultiFirm: e.target.checked }))}
                disabled={!canManageCompany}
                className="size-[18px] accent-[var(--color-brand-600)]"
              />
              <span className="flex items-center gap-1.5 text-sm">
                Multi Firm
                <InfoHint text="Run more than one business entity inside this company. Parties and items stay shared; invoices are numbered per firm." />
              </span>
            </label>
          </div>

          {canManageCompany && profileDirty ? (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setProfile(company)}>
                Discard
              </Button>
              <Button size="sm" onClick={() => void saveProfile()} loading={savingProfile}>
                Save company
              </Button>
            </div>
          ) : null}
        </SettingsGroup>
      </div>

      {/* Firms */}
      <div className="surface-card p-5">
        <SettingsGroup
          title="Firms"
          description="Each firm issues invoices under its own GSTIN and number series."
        >
          <div className="space-y-2">
            {firms.map((firm) => (
              <div
                key={firm.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  firm.isDefault
                    ? "border-brand-400 bg-brand-50/50 dark:bg-brand-950/40"
                    : "border-[var(--border-subtle)]",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--surface-3)]">
                  <Building2 className="size-4 text-[var(--text-secondary)]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{firm.name}</span>
                    {firm.isDefault ? <Badge variant="brand">Default</Badge> : null}
                  </div>
                  {firm.gstin ? (
                    <div className="truncate text-[12px] text-[var(--text-muted)]">
                      GSTIN {firm.gstin}
                    </div>
                  ) : null}
                </div>
                {firm.isDefault ? <Check className="size-4 shrink-0 text-brand-600" /> : null}
                <Button asChild variant="ghost" size="iconSm">
                  <a href={`/settings/firms?edit=${firm.id}`} aria-label={`Edit ${firm.name}`}>
                    <Pencil className="size-4" />
                  </a>
                </Button>
              </div>
            ))}
          </div>

          <Button asChild variant="outline" size="sm">
            <a href="/settings/firms">Manage firms</a>
          </Button>
        </SettingsGroup>
      </div>

      {/* Application + more transactions + backup */}
      <SettingsForm tab="general" initial={initial} canWrite={canWrite}>
        {(values, set) => (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="surface-card p-5">
              <SettingsGroup title="Application">
                <SettingToggle
                  id="enablePasscode"
                  label="Enable passcode"
                  hint="Ask for a passcode when the app is reopened on this device."
                  checked={values.enablePasscode}
                  onChange={(v) => set("enablePasscode", v)}
                />

                <Field id="businessCurrency" label="Business currency">
                  <Select
                    value={values.businessCurrency}
                    onValueChange={(v) => set("businessCurrency", v)}
                  >
                    <SelectTrigger id="businessCurrency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">₹ Indian Rupee</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  id="decimalPlaces"
                  label="Amount decimal places"
                  hint="e.g. 0.00"
                >
                  <Input
                    id="decimalPlaces"
                    type="number"
                    min={0}
                    max={4}
                    value={values.decimalPlaces}
                    onChange={(e) => set("decimalPlaces", Number(e.target.value))}
                    className="w-24"
                  />
                </Field>

                <SettingToggle
                  id="showGstinNumber"
                  label="GSTIN number"
                  hint="Show the GSTIN field on parties and firms."
                  checked={values.showGstinNumber}
                  onChange={(v) => set("showGstinNumber", v)}
                />
                <SettingToggle
                  id="stopSaleOnNegativeStock"
                  label="Stop sale on negative stock"
                  hint="Refuse a sale that would take an item below zero. Off by default."
                  checked={values.stopSaleOnNegativeStock}
                  onChange={(v) => set("stopSaleOnNegativeStock", v)}
                />
                <SettingToggle
                  id="blockNewItemsFromTxnForm"
                  label="Block new items from transaction form"
                  checked={values.blockNewItemsFromTxnForm}
                  onChange={(v) => set("blockNewItemsFromTxnForm", v)}
                />
                <SettingToggle
                  id="blockNewPartiesFromTxnForm"
                  label="Block new parties from transaction form"
                  checked={values.blockNewPartiesFromTxnForm}
                  onChange={(v) => set("blockNewPartiesFromTxnForm", v)}
                />
              </SettingsGroup>
            </div>

            <div className="surface-card p-5">
              <SettingsGroup
                title="More Transactions"
                description="These toggles show and hide whole sections of the sidebar."
              >
                <SettingToggle
                  id="enableEstimate"
                  label="Estimate / Quotation"
                  checked={values.enableEstimate}
                  onChange={(v) => set("enableEstimate", v)}
                />
                <SettingToggle
                  id="enableProforma"
                  label="Proforma Invoice"
                  checked={values.enableProforma}
                  onChange={(v) => set("enableProforma", v)}
                />
                <SettingToggle
                  id="enableOrders"
                  label="Sale / Purchase Order"
                  checked={values.enableOrders}
                  onChange={(v) => set("enableOrders", v)}
                />
                <SettingToggle
                  id="enableDeliveryChallan"
                  label="Delivery Challan"
                  checked={values.enableDeliveryChallan}
                  onChange={(v) => set("enableDeliveryChallan", v)}
                >
                  <SettingToggle
                    id="goodsReturnOnDeliveryChallan"
                    label="Goods return on delivery challan"
                    checked={values.goodsReturnOnDeliveryChallan}
                    onChange={(v) => set("goodsReturnOnDeliveryChallan", v)}
                  />
                  <SettingToggle
                    id="printAmountInDeliveryChallan"
                    label="Print amount in delivery challan"
                    checked={values.printAmountInDeliveryChallan}
                    onChange={(v) => set("printAmountInDeliveryChallan", v)}
                  />
                </SettingToggle>
                <SettingToggle
                  id="enableOtherIncome"
                  label="Other Income"
                  checked={values.enableOtherIncome}
                  onChange={(v) => set("enableOtherIncome", v)}
                />
                <SettingToggle
                  id="enableFixedAssets"
                  label="Fixed Assets (FA)"
                  checked={values.enableFixedAssets}
                  onChange={(v) => set("enableFixedAssets", v)}
                />
              </SettingsGroup>
            </div>

            <div className="space-y-8">
              <div className="surface-card p-5">
                <SettingsGroup title="Backup & History">
                  <SettingToggle
                    id="autoBackup"
                    label="Auto backup"
                    hint="Take a nightly snapshot you can restore from."
                    checked={values.autoBackup}
                    onChange={(v) => set("autoBackup", v)}
                  />
                  <p className="text-[12px] text-[var(--text-muted)]">
                    {lastBackupAt
                      ? `Last Backup ${formatDateTime(lastBackupAt)}`
                      : "No backup taken yet"}
                  </p>
                  <SettingToggle
                    id="auditTrail"
                    label="Audit trail"
                    hint="Record who created, changed or deleted every record."
                    checked={values.auditTrail}
                    onChange={(v) => set("auditTrail", v)}
                  />
                </SettingsGroup>
              </div>

              <div className="surface-card p-5">
                <SettingsGroup
                  title="Customize Your View"
                  description="Resize the screen to suit your display."
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[13px]">
                      <span className="text-[var(--text-secondary)]">Screen zoom</span>
                      <span className="tnum font-medium">{values.screenZoom}%</span>
                    </div>
                    <input
                      type="range"
                      min={70}
                      max={130}
                      step={10}
                      value={values.screenZoom}
                      onChange={(e) => set("screenZoom", Number(e.target.value))}
                      className="w-full accent-[var(--color-brand-600)]"
                      aria-label="Screen zoom"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]">
                      {ZOOM_STOPS.map((z) => (
                        <span key={z}>{z}</span>
                      ))}
                    </div>
                  </div>

                  <Field id="theme" label="Appearance">
                    <Select
                      value={values.theme}
                      onValueChange={(v) => set("theme", v as GeneralSettings["theme"])}
                    >
                      <SelectTrigger id="theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">Match system</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </SettingsGroup>
              </div>
            </div>
          </div>
        )}
      </SettingsForm>
    </div>
  );
}
