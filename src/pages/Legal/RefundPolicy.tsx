import { LegalPageLayout } from '@/components/shared/LegalPageLayout'
import { CONFIG } from '@/constants/config'

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      title="Refund Policy"
      description="When and how Divya Foods issues refunds for orders, damaged items, and cancellations."
      lastUpdated="8 July 2026"
    >
      <p>
        Because most of what we sell is frozen or fresh perishable food, our refund policy is built around food safety
        and quality — not general "no questions asked" returns. This page explains exactly when a refund applies.
      </p>

      <h2>Eligible for a Refund</h2>
      <ul>
        <li><strong>Order cancelled before dispatch</strong> — full refund, automatically initiated once the cancellation is confirmed.</li>
        <li><strong>Wrong item delivered</strong> — full refund or free replacement, your choice.</li>
        <li><strong>Damaged or spoiled on arrival</strong> — full refund or free replacement, provided you notify us within <strong>24 hours of delivery</strong> with photos of the item and its packaging.</li>
        <li><strong>Item missing from your delivery</strong> — refund for the missing item's value.</li>
        <li><strong>Payment debited but order not confirmed</strong> — full refund, typically auto-reversed by Razorpay within 5–7 business days; contact us if it hasn't appeared.</li>
      </ul>

      <h2>Not Eligible for a Refund</h2>
      <ul>
        <li>Change of mind after an order has been dispatched — perishable goods already in the cold chain cannot be resold.</li>
        <li>Products correctly delivered as described, where the complaint relates to personal taste preference rather than quality or accuracy.</li>
        <li>Damage caused by improper storage after delivery (e.g. left unrefrigerated).</li>
        <li>Claims raised more than 24 hours after delivery.</li>
      </ul>

      <h2>How Refunds Are Processed</h2>
      <p>
        All refunds are issued to your original payment method via Razorpay — we do not issue cash refunds. Once a
        refund is approved:
      </p>
      <ul>
        <li>You'll receive an email confirming the refund amount.</li>
        <li>Funds typically reflect in your account within <strong>5–7 business days</strong>, depending on your bank or card issuer.</li>
        <li>For orders paid via UPI or netbanking, refunds are usually faster (2–4 business days).</li>
      </ul>

      <h2>How to Request a Refund</h2>
      <p>
        Email <a href={`mailto:${CONFIG.CONTACT.EMAIL}`}>{CONFIG.CONTACT.EMAIL}</a> or call{' '}
        <strong>{CONFIG.CONTACT.PHONE_1}</strong> with your order number and, for damage/quality claims, photos of the
        item. You can also track and manage your order from the "My Orders" page in your account.
      </p>

      <h2>Related Policies</h2>
      <p>
        See also our <a href="/cancellation-policy">Cancellation Policy</a> for how cancellations work before an order
        ships, and our <a href="/shipping-policy">Shipping Policy</a> for delivery timelines and cold-chain handling.
      </p>
    </LegalPageLayout>
  )
}
