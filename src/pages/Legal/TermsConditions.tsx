import { LegalPageLayout } from '@/components/shared/LegalPageLayout'
import { CONFIG } from '@/constants/config'

export default function TermsConditionsPage() {
  return (
    <LegalPageLayout
      title="Terms &amp; Conditions"
      description="The terms that govern your use of Divya Luxury Seafoods and your purchases through the Site."
      lastUpdated="8 July 2026"
    >
      <p>
        These Terms &amp; Conditions ("Terms") govern your access to and use of {CONFIG.APP_NAME} (the "Site") and any
        purchase you make through it. By placing an order or creating an account, you agree to these Terms.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 18 years old, or place orders under the supervision of a parent or guardian, and be
        capable of entering into a legally binding contract under the Indian Contract Act, 1872.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and for all activity under
        your account. Notify us immediately at <a href={`mailto:${CONFIG.CONTACT.EMAIL}`}>{CONFIG.CONTACT.EMAIL}</a> if
        you suspect unauthorized use.
      </p>

      <h2>Products &amp; Pricing</h2>
      <ul>
        <li>All prices are listed in Indian Rupees (₹) and are inclusive of applicable GST unless stated otherwise.</li>
        <li>We reserve the right to correct pricing errors and to modify prices at any time before an order is placed.</li>
        <li>Product images are representative; actual weight, size, and packaging of frozen/fresh seafood may vary slightly by batch.</li>
        <li>Stock availability is not guaranteed until your order is confirmed and payment is verified.</li>
      </ul>

      <h2>Orders &amp; Payment</h2>
      <p>
        Orders are processed once payment is successfully verified through Razorpay, our payment partner. We reserve
        the right to cancel any order at our discretion — for example if a product is out of stock, if there is a
        suspected pricing error, or if fraud is suspected — in which case any payment already made will be refunded in
        full.
      </p>

      <h2>Delivery</h2>
      <p>
        We currently deliver to {CONFIG.DELIVERY.AREAS.join(', ')}. Delivery timelines quoted at checkout and in our{' '}
        <a href="/shipping-policy">Shipping Policy</a> are estimates and not guarantees — please see that policy for
        full details, including handling of perishable goods.
      </p>

      <h2>Cancellations, Returns &amp; Refunds</h2>
      <p>
        Given the perishable nature of most of our products, cancellation and refund eligibility differs from typical
        e-commerce goods. Full details are in our <a href="/cancellation-policy">Cancellation Policy</a> and{' '}
        <a href="/refund-policy">Refund Policy</a>.
      </p>

      <h2>User Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Site for any unlawful purpose, or in a way that could damage, disable, or impair it.</li>
        <li>Attempt to gain unauthorized access to any part of the Site, other users' accounts, or our systems.</li>
        <li>Submit false, fraudulent, or abusive information via any form on the Site, including the checkout or contact form.</li>
      </ul>

      <h2>Intellectual Property</h2>
      <p>
        All content on the Site — including text, graphics, logos, and product photography — is owned by or licensed to{' '}
        {CONFIG.APP_NAME} and may not be copied or reused without our written permission.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, {CONFIG.APP_NAME} is not liable for any indirect, incidental, or
        consequential damages arising from your use of the Site or the products purchased through it. Our total
        liability for any claim is limited to the amount you paid for the order giving rise to that claim.
      </p>

      <h2>Governing Law</h2>
      <p>
        These Terms are governed by the laws of India. Any dispute arising from these Terms or your use of the Site
        will be subject to the exclusive jurisdiction of the courts of New Delhi, India.
      </p>

      <h2>Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the Site after changes are posted constitutes
        acceptance of the revised Terms.
      </p>

      <h2>Contact Us</h2>
      <p>
        Questions about these Terms? Contact us at <a href={`mailto:${CONFIG.CONTACT.EMAIL}`}>{CONFIG.CONTACT.EMAIL}</a>{' '}
        or {CONFIG.CONTACT.PHONE_1}.
      </p>
    </LegalPageLayout>
  )
}
