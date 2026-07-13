import { LegalPageLayout } from '@/components/shared/LegalPageLayout'
import { CONFIG } from '@/constants/config'

export default function CookiesPolicyPage() {
  return (
    <LegalPageLayout
      title="Cookies Policy"
      description="How Divya Foods uses browser storage to keep you signed in and your cart in sync."
      lastUpdated="8 July 2026"
    >
      <p>
        Unlike many websites, {CONFIG.APP_NAME} does not rely on traditional tracking cookies for its core
        functionality. Instead, we use your browser's local storage — data saved directly in your browser rather than
        sent to third-party ad networks. Here's exactly what we store and why.
      </p>

      <h2>What We Store in Your Browser</h2>
      <ul>
        <li><strong>Sign-in session</strong> — a security token that keeps you logged in between visits, so you don't have to re-enter your password every time.</li>
        <li><strong>Shopping cart</strong> — the items in your cart, so they're still there if you close the tab and come back later.</li>
        <li><strong>Display preference</strong> — whether you've chosen light or dark mode.</li>
        <li><strong>Install prompt</strong> — whether you've already dismissed the "Install App" prompt, so we don't show it again unnecessarily.</li>
        <li><strong>Recent searches</strong> — your recent product searches on this device, to speed up the search box's suggestions.</li>
      </ul>
      <p>
        None of this data is sold to advertisers, and none of it is used for cross-site tracking. It stays in your
        browser and is only sent to our own servers when needed (e.g. your sign-in token, to authenticate your
        requests).
      </p>

      <h2>Third-Party Cookies</h2>
      <p>
        When you pay via Razorpay's checkout window, Razorpay (and the banks/UPI apps it connects to) may set their
        own cookies to process your payment securely and prevent fraud. These are governed by{' '}
        <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer">Razorpay's own privacy policy</a>,
        not by us.
      </p>

      <h2>Managing Browser Storage</h2>
      <p>
        You can clear local storage at any time through your browser's settings (typically under "Privacy" or "Site
        Data"). Doing so will sign you out and clear your saved cart, but won't affect your account or order history,
        which remain safely stored on our servers.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        If we introduce analytics or advertising cookies in the future, we'll update this page and, where required by
        law, ask for your consent first.
      </p>

      <h2>Questions</h2>
      <p>
        Contact us at <a href={`mailto:${CONFIG.CONTACT.EMAIL}`}>{CONFIG.CONTACT.EMAIL}</a> for anything related to
        this policy.
      </p>
    </LegalPageLayout>
  )
}
