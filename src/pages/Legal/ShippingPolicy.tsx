import { LegalPageLayout } from '@/components/shared/LegalPageLayout'
import { CONFIG } from '@/constants/config'

export default function ShippingPolicyPage() {
  return (
    <LegalPageLayout
      title="Shipping Policy"
      description="Delivery areas, timelines, cold-chain handling, and charges for Divya Luxury Seafoods orders."
      lastUpdated="8 July 2026"
    >
      <h2>Delivery Areas</h2>
      <p>
        We currently deliver across {CONFIG.DELIVERY.AREAS.join(', ')}. If your pincode falls outside these areas,
        please contact us before ordering — we occasionally accommodate nearby locations for larger/bulk orders.
      </p>

      <h2>Delivery Timelines</h2>
      <ul>
        <li>Orders are processed within <strong>24 hours</strong> of payment confirmation.</li>
        <li>Standard delivery takes <strong>2–4 business days</strong> from dispatch.</li>
        <li>If you selected a specific delivery slot at checkout, we deliver within that window wherever possible; slot availability depends on your area and courier capacity.</li>
        <li>Delivery timelines are estimates, not guarantees — weather, courier delays, or force majeure events may extend them. We'll notify you by email if there's a significant delay.</li>
      </ul>

      <h2>Delivery Charges</h2>
      <ul>
        <li>Free delivery on orders above ₹{CONFIG.DELIVERY.FREE_DELIVERY_ABOVE.toLocaleString('en-IN')}.</li>
        <li>A flat delivery charge of ₹{CONFIG.DELIVERY.STANDARD_CHARGE} applies below that threshold.</li>
        <li>Silver/Gold/Platinum membership tiers may unlock additional free-delivery thresholds or perks — see your account's Loyalty page.</li>
        <li>Minimum order value: ₹{CONFIG.DELIVERY.MIN_ORDER_AMOUNT}.</li>
      </ul>

      <h2>Cold-Chain Handling</h2>
      <p>
        Frozen and fresh seafood is packed with dry ice or gel packs in insulated packaging to maintain cold-chain
        integrity in transit. Please arrange to receive perishable deliveries promptly — if no one is available to
        receive the order, product quality may be affected, and we are not responsible for spoilage caused by delayed
        collection at the doorstep.
      </p>

      <h2>Order Tracking</h2>
      <p>
        Once your order is dispatched, you'll receive a shipping confirmation email. You can also track your order's
        status at any time from the <a href="/track-order">Track Order</a> page or your account's order history.
      </p>

      <h2>Delivery Partners</h2>
      <p>
        We use a combination of our own delivery riders and third-party logistics partners (such as Porter and Dunzo)
        depending on your area and order size.
      </p>

      <h2>Questions</h2>
      <p>
        For delivery queries, call <strong>{CONFIG.CONTACT.PHONE_1}</strong> or email{' '}
        <a href={`mailto:${CONFIG.CONTACT.EMAIL}`}>{CONFIG.CONTACT.EMAIL}</a>.
      </p>
    </LegalPageLayout>
  )
}
