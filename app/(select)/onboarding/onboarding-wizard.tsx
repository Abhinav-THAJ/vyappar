"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/controls";
import { Field, FormError } from "@/components/forms/form-field";
import { SampleInvoicePreview } from "@/components/txn/sample-invoice-preview";
import { Logo } from "@/components/brand/logo";
import { INDIAN_STATES, DEFAULT_STATE_CODE, validateGstin } from "@/lib/gst";
import {
  createCompanySchema,
  BUSINESS_CATEGORIES,
  type CreateCompanyInput,
} from "@/lib/validators/company";
import { createCompanyAction } from "@/server/actions/company";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STEPS = [
  { key: "business", title: "Enter Business Details", fields: ["companyName", "phone", "businessCategory"] },
  { key: "tax", title: "Tax Details", fields: ["gstin", "stateCode"] },
  { key: "address", title: "Address & Contact", fields: ["addressLine1", "addressLine2", "city", "pincode", "email"] },
  { key: "prefs", title: "Preferences", fields: ["fyStartMonth"] },
] as const;

type FieldName = keyof CreateCompanyInput;

/**
 * The "Set Up My Business" wizard (ref-10): a form on the left and a live
 * sample invoice on the right that updates as you type.
 *
 * Creates a Company *and* its first Firm in one transaction — the two-level
 * model means an invoice needs both before it can exist (D-20).
 */
export function OnboardingWizard({
  userName,
  canCancel,
}: {
  userName: string;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    mode: "onChange",
    defaultValues: {
      companyName: "",
      phone: "",
      businessCategory: undefined,
      gstin: undefined,
      stateCode: DEFAULT_STATE_CODE,
      isGstEnabled: true,
      addressLine1: undefined,
      addressLine2: undefined,
      city: undefined,
      pincode: undefined,
      email: undefined,
      fyStartMonth: 4,
    },
  });

  const { register, handleSubmit, watch, setValue, setError, trigger, formState } = form;
  const values = watch();

  // The GSTIN encodes its state, so selecting one fills the other in.
  React.useEffect(() => {
    const gstin = values.gstin;
    if (gstin && gstin.length === 15) {
      const result = validateGstin(gstin);
      if (result.valid && result.stateCode && result.stateCode !== values.stateCode) {
        setValue("stateCode", result.stateCode, { shouldValidate: true });
      }
    }
  }, [values.gstin, values.stateCode, setValue]);

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  async function next() {
    const valid = await trigger(current.fields as unknown as FieldName[]);
    if (!valid) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onSubmit(input: CreateCompanyInput) {
    setFormError(null);
    const result = await createCompanyAction(input);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as FieldName, { message: messages[0] });
      }
      // Jump back to whichever step owns the first bad field.
      const bad = Object.keys(result.fieldErrors ?? {})[0];
      if (bad) {
        const idx = STEPS.findIndex((s) => (s.fields as readonly string[]).includes(bad));
        if (idx >= 0) setStep(idx);
      }
      return;
    }

    toast.success(`${input.companyName} is ready`);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-[var(--surface-2)]">
      <div className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 sm:px-6">
        <Logo />
        {canCancel ? (
          <button
            type="button"
            onClick={() => router.push("/companies")}
            className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
            aria-label="Cancel setup"
          >
            <X className="size-5" />
          </button>
        ) : null}
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Form */}
        <div className="surface-card flex flex-col p-6">
          <div>
            <p className="text-[13px] text-[var(--text-muted)]">
              Welcome, {userName.split(" ")[0]}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{current.title}</h1>
          </div>

          {/* Step rail */}
          <ol className="mt-5 flex items-center gap-2" aria-label="Setup progress">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors",
                    i < step
                      ? "bg-brand-600 text-white"
                      : i === step
                        ? "bg-brand-600 text-white"
                        : "bg-[var(--surface-3)] text-[var(--text-muted)]",
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                {i < STEPS.length - 1 ? (
                  <span
                    className={cn(
                      "h-0.5 flex-1 rounded",
                      i < step ? "bg-brand-600" : "bg-[var(--surface-3)]",
                    )}
                  />
                ) : null}
              </li>
            ))}
          </ol>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-1 flex-col" noValidate>
            <div className="flex-1 space-y-4">
              <FormError message={formError} />

              {step === 0 ? (
                <>
                  <Field
                    id="companyName"
                    label="Company Name"
                    required
                    error={formState.errors.companyName?.message}
                  >
                    <Input
                      id="companyName"
                      autoFocus
                      placeholder="Bella Events"
                      invalid={!!formState.errors.companyName}
                      {...register("companyName")}
                    />
                  </Field>

                  <Field
                    id="phone"
                    label="Phone Number"
                    required
                    error={formState.errors.phone?.message}
                  >
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="9946050006"
                      invalid={!!formState.errors.phone}
                      {...register("phone")}
                    />
                  </Field>

                  <Field
                    id="businessCategory"
                    label="Choose Business Category"
                    required
                    error={formState.errors.businessCategory?.message}
                  >
                    <Select
                      value={values.businessCategory}
                      onValueChange={(v) =>
                        setValue("businessCategory", v as CreateCompanyInput["businessCategory"], {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger id="businessCategory" invalid={!!formState.errors.businessCategory}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <label className="flex items-start gap-2.5">
                    <Checkbox
                      checked={values.isGstEnabled}
                      onCheckedChange={(v) => setValue("isGstEnabled", v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="text-sm">My business is GST registered</span>
                      <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">
                        Turn this off to issue invoices without GST. You can change it later.
                      </span>
                    </span>
                  </label>

                  {values.isGstEnabled ? (
                    <Field
                      id="gstin"
                      label="GSTIN"
                      hint="15 characters. The state is filled in automatically."
                      error={formState.errors.gstin?.message}
                    >
                      <Input
                        id="gstin"
                        placeholder="32FNWPS9685D1Z1"
                        maxLength={15}
                        className="uppercase"
                        invalid={!!formState.errors.gstin}
                        {...register("gstin")}
                      />
                    </Field>
                  ) : null}

                  <Field
                    id="stateCode"
                    label="State"
                    required
                    error={formState.errors.stateCode?.message}
                  >
                    <Select
                      value={values.stateCode}
                      onValueChange={(v) => setValue("stateCode", v, { shouldValidate: true })}
                    >
                      <SelectTrigger id="stateCode">
                        <SelectValue placeholder="Select a state" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((s) => (
                          <SelectItem key={s.code} value={s.code}>
                            {s.code} — {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <Field
                    id="addressLine1"
                    label="Address line 1"
                    error={formState.errors.addressLine1?.message}
                  >
                    <Input
                      id="addressLine1"
                      placeholder="Ground Floor, Patthayappura Complex"
                      {...register("addressLine1")}
                    />
                  </Field>
                  <Field
                    id="addressLine2"
                    label="Address line 2"
                    error={formState.errors.addressLine2?.message}
                  >
                    <Textarea id="addressLine2" rows={2} {...register("addressLine2")} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="city" label="City" error={formState.errors.city?.message}>
                      <Input id="city" placeholder="Thrissur" {...register("city")} />
                    </Field>
                    <Field id="pincode" label="PIN code" error={formState.errors.pincode?.message}>
                      <Input
                        id="pincode"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="680001"
                        invalid={!!formState.errors.pincode}
                        {...register("pincode")}
                      />
                    </Field>
                  </div>
                  <Field id="email" label="Email" error={formState.errors.email?.message}>
                    <Input
                      id="email"
                      type="email"
                      placeholder="hello@business.in"
                      invalid={!!formState.errors.email}
                      {...register("email")}
                    />
                  </Field>
                </>
              ) : null}

              {step === 3 ? (
                <Field
                  id="fyStartMonth"
                  label="Financial year starts in"
                  hint="India defaults to April. This drives invoice numbering resets and every report."
                  error={formState.errors.fyStartMonth?.message}
                >
                  <Select
                    value={String(values.fyStartMonth)}
                    onValueChange={(v) =>
                      setValue("fyStartMonth", Number(v), { shouldValidate: true })
                    }
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
              ) : null}
            </div>

            <div className="mt-8 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-5">
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              ) : canCancel ? (
                <Button type="button" variant="ghost" onClick={() => router.push("/companies")}>
                  Cancel
                </Button>
              ) : (
                <span />
              )}

              {isLast ? (
                <Button type="submit" loading={formState.isSubmitting}>
                  {formState.isSubmitting ? "Creating…" : "Create company"}
                  <Check className="size-4" />
                </Button>
              ) : (
                <Button type="button" onClick={next}>
                  Next
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Live preview */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <h2 className="mb-3 text-center text-[13px] font-semibold text-[var(--text-secondary)]">
              Sample Tax Invoice
            </h2>
            <SampleInvoicePreview
              firm={{
                name: values.companyName,
                gstin: values.isGstEnabled ? values.gstin : null,
                stateCode: values.stateCode,
                addressLine1: values.addressLine1,
                addressLine2: values.addressLine2,
                city: values.city,
                pincode: values.pincode,
                phone: values.phone,
                email: values.email,
              }}
            />
            <p className="mt-3 text-center text-[12px] text-[var(--text-muted)]">
              This is how your invoices will be headed. You can change every detail later
              in Settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
