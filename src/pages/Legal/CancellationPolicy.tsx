import { LegalPageLayout } from '@/components/shared/LegalPageLayout'
import { CONFIG } from '@/constants/config'

export default function CancellationPolicyPage() {
  return (
    <LegalPageLayout
      title="Cancellation Policy"
      description="How and when you can cancel an order placed with Divya Luxury Seafoods."
      lastUpdated="8 July 2026"
    >
      <h2>Self-Service Cancellation</h2>
      <p>
        You can cancel an order yourself from the <a href="/orders">My Orders</a> page as long as it is still in{' '}
        <strong>Pending</strong> or <strong>Confirmed</strong> status — that is, any time before we begin packing it
        for dispatch. Cancelling at this stage is instant and results in a full refund of any amount already paid.
      </p>

      <h2>After Packing Has Begun</h2>
      <p>
        Once an order moves to <strong>Processing</strong> status, self-service cancellation is no longer available,
        because our team has begun preparing your perishable items. If you need to cancel at this stage, call us
        immediately at <strong>{CONFIG.CONTACT.PHONE_1}</strong> — we'll do our best to stop dispatch, but we cannot
        guarantee it once packing is underway.
      </p>

      <h2>After Dispatch</h2>
      <p>
        Orders that have already been dispatched cannot be cancelled, since frozen/fresh goods are already in transit
        within the cold chain. If there's a genuine problem with your delivery (wrong item, damage, spoilage), see our{' '}
        <a href="/refund-policy">Refund Policy</a> instead.
      </p>

      <h2>Cancellation by Us</h2>
      <p>
        We may cancel an order — with a full refund — if a product turns out to be unexpectedly out of stock, if we
        detect a pricing error, if delivery to your address isn't feasible, or if we suspect fraudulent activity.
        We'll always email you if this happens.
      </p>

      <h2>Gift Cards &amp; Store Credit</h2>
      <p>
        If a gift card or store credit was applied to a cancelled order, the redeemed amount is restored to your gift
        card balance automatically upon cancellation.
      </p>

      <h2>Bulk / Wholesale Orders</h2>
      <p>
        Cancellation terms for bulk or business orders placed through our{' '}
        <a href="/bulk-order">Bulk Order</a> program may differ and are confirmed individually at the time of
        quotation, given the custom sourcing involved.
      </p>

      <h2>Need Help?</h2>
      <p>
        Contact us at <a href={`mailto:${CONFIG.CONTACT.EMAIL}`}>{CONFIG.CONTACT.EMAIL}</a> or{' '}
        <strong>{CONFIG.CONTACT.PHONE_1}</strong> and we'll help however we can.
      </p>
    </LegalPageLayout>
  )
}
