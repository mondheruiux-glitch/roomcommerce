import { redirect } from 'next/navigation';

/**
 * SCR-09: Billing & Pass Management screen.
 * Redirects to the unified account page with the billing section anchored.
 * The full billing content is rendered in /account — this redirect
 * keeps the URL canonical while satisfying the E2E + a11y audit route expectations.
 */
export default function BillingPage() {
  redirect('/account#billing');
}
