import { redirect } from 'next/navigation';

/**
 * SCR-10: Account Settings screen.
 * Redirects to the unified account page with the settings section anchored.
 * The full settings content is rendered in /account — this redirect
 * keeps the URL canonical while satisfying the E2E + a11y audit route expectations.
 */
export default function SettingsPage() {
  redirect('/account#settings');
}
