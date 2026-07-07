import { LegalPageLayout } from '@/components/shared/LegalPageLayout'
import { CONFIG } from '@/constants/config'

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="How Divya Luxury Seafoods collects, uses, and protects your personal data."
      lastUpdated="8 July 2026"
    >
      <p>
        {CONFIG.APP_NAME} ("we", "us", "our") operates this website (the "Site"). This Privacy Policy explains what
        personal data we collect when you use the Site, why we collect it, and how you can control it. By using the
        Site, you agree to the practices described here.
      </p>

      <h2>Information We Collect</h2>
      <ul>
        <li><strong>Account details:</strong> name, email address, phone number, and password (stored as a one-way bcrypt hash — we never store or can retrieve your plaintext password).</li>
        <li><strong>Order details:</strong> delivery address, order contents, order value, and delivery preferences.</li>
        <li><strong>Payment information:</strong> we do not store your card, UPI, or net-banking details. Payments are processed directly by Razorpay, our PCI-DSS-compliant payment gateway; we only receive a payment confirmation and transaction ID.</li>
        <li><strong>Guest checkout:</strong> if you check out without an account, we store your name, email, and phone solely to fulfil and track that order.</li>
        <li><strong>Usage data:</strong> pages viewed, products browsed, and cart contents, used to keep your cart in sync and improve the Site.</li>
        <li><strong>Communications:</strong> messages you send us via the Contact form, along with your name, email, and phone.</li>
      </ul>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To process and deliver your orders, including sharing your name, phone, and delivery address with our logistics/delivery partners.</li>
        <li>To send transactional emails: order confirmations, shipping updates, invoices, password resets, and — only if you opt in — promotional updates.</li>
        <li>To provide customer support and respond to enquiries.</li>
        <li>To detect and prevent fraud, abuse, and unauthorized access to your account.</li>
        <li>To comply with tax, GST, and FSSAI record-keeping obligations under Indian law.</li>
      </ul>

      <h2>Data Sharing</h2>
      <p>
        We do not sell your personal data. We share it only with:
      </p>
      <ul>
        <li><strong>Razorpay</strong> — to process your payment.</li>
        <li><strong>Delivery partners</strong> (e.g. Porter, Dunzo, or our in-house riders) — to deliver your order.</li>
        <li><strong>Cloudinary</strong> — our image hosting provider, which stores product images only (not customer data).</li>
        <li>Law enforcement or regulators, only where legally required.</li>
      </ul>

      <h2>Data Security</h2>
      <p>
        Passwords are hashed with bcrypt and never stored in plaintext. All traffic between your browser and our servers
        is encrypted with HTTPS/TLS. Access to customer and order data within our admin panel is restricted to
        authenticated staff accounts with the admin or developer role.
      </p>

      <h2>Data Retention</h2>
      <p>
        We retain account and order data for as long as your account is active, and for a further period afterward as
        required for tax, accounting, and consumer-dispute purposes under Indian law. You may request deletion of your
        account at any time by contacting us — see below.
      </p>

      <h2>Your Rights</h2>
      <p>
        You can review and update your profile details at any time from your account page. To request a copy of your
        data, or to request that we delete your account and associated personal data, email us at{' '}
        <a href={`mailto:${CONFIG.CONTACT.EMAIL}`}>{CONFIG.CONTACT.EMAIL}</a>.
      </p>

      <h2>Children's Privacy</h2>
      <p>
        The Site is not directed at children under 18. We do not knowingly collect personal data from children.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "Last
        updated" date at the top of this page.
      </p>

      <h2>Contact Us</h2>
      <p>
        Questions about this policy? Contact us at <a href={`mailto:${CONFIG.CONTACT.EMAIL}`}>{CONFIG.CONTACT.EMAIL}</a>,{' '}
        {CONFIG.CONTACT.PHONE_1}, or write to us at {CONFIG.CONTACT.ADDRESS}.
      </p>
    </LegalPageLayout>
  )
}
