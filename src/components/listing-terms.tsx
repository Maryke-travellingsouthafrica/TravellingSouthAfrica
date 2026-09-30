import type { ReactNode } from 'react';
import Link from 'next/link';
import { Translatable } from '@/components/translatable';

// Single source for the business listing T&Cs shown on every listing form,
// so the wording and link can't drift between pages.
export const LISTING_TERMS_HREF = '/business-listing-terms';

// Bordered box with the decline/liability notice. Pass the agreement row
// (checkbox + ListingTermsAgreement + ListingTermsTrialNote) as children.
export function ListingTerms({ children }: { children?: ReactNode }) {
  return (
    <div className="space-y-4 rounded-lg border bg-secondary p-4">
      <p className="text-sm text-muted-foreground">
        <Translatable text="Travelling South Africa reserves the right to decline any listing application if it is found not reputable or possibly harmful. Travelling South Africa does not bear any responsibility for any transactions made between guests/users and clients/advertisers." />
      </p>
      {children}
    </div>
  );
}

// Label content for the agreement checkbox.
export function ListingTermsAgreement() {
  return (
    <>
      <Translatable text="I have read and agree to the " />
      <Link
        href={LISTING_TERMS_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-primary"
      >
        <Translatable text="Business Listing Terms & Conditions" />
      </Link>
      <Translatable text="." />
    </>
  );
}

export function ListingTermsTrialNote() {
  return (
    <p className="text-sm text-muted-foreground">
      <Translatable text="60-day free trial — no payment required. Before your trial ends, we'll contact you to see if you'd like to continue. If you choose to continue, the annual listing fee is R350." />
    </p>
  );
}
