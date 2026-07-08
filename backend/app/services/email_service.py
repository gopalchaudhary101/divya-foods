"""
Email service — HTML transactional emails via SMTP.

Sending is fire-and-forget (daemon thread) so it never blocks an HTTP response.
If SMTP credentials are missing the functions return immediately without error.
Transient SMTP failures (network blips, momentary auth hiccups) are retried
a couple of times with a short backoff before being logged as a real failure.
"""

import logging
import smtplib
import threading
import time
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape as _esc

from app.config import settings

logger = logging.getLogger("app.email")

_MAX_ATTEMPTS = 3
_RETRY_DELAY_SECONDS = 2


def _build_message(to: str, subject: str, html: str, attachment: bytes = None, filename: str = "") -> MIMEMultipart:
    if attachment is not None:
        msg = MIMEMultipart("mixed")
        msg["Subject"], msg["From"], msg["To"] = subject, settings.EMAIL_FROM, to
        body = MIMEMultipart("alternative")
        body.attach(MIMEText(html, "html", "utf-8"))
        msg.attach(body)
        part = MIMEApplication(attachment, _subtype="pdf")
        part.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(part)
        return msg

    msg = MIMEMultipart("alternative")
    msg["Subject"], msg["From"], msg["To"] = subject, settings.EMAIL_FROM, to
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


def _deliver(msg: MIMEMultipart, to: str) -> None:
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as srv:
        srv.ehlo()
        srv.starttls()
        srv.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        srv.sendmail(settings.EMAIL_FROM, to, msg.as_string())


def _send_with_retry(to: str, subject: str, html: str, attachment: bytes = None, filename: str = "") -> None:
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        return  # SMTP not configured — skip silently, never crash the caller

    msg = _build_message(to, subject, html, attachment, filename)
    last_error = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            _deliver(msg, to)
            logger.info("Sent '%s' to %s (attempt %d)", subject, to, attempt)
            return
        except Exception as exc:  # noqa: BLE001 — SMTP failures must never crash the caller
            last_error = exc
            if attempt < _MAX_ATTEMPTS:
                time.sleep(_RETRY_DELAY_SECONDS * attempt)
    logger.error("Failed to send '%s' to %s after %d attempts: %s", subject, to, _MAX_ATTEMPTS, last_error)


def send_async(to: str, subject: str, html: str) -> None:
    """Fire-and-forget — spawns a daemon thread."""
    if not to:
        return
    threading.Thread(target=_send_with_retry, args=(to, subject, html), daemon=True).start()


def _send_with_attachment(to: str, subject: str, html: str, attachment: bytes, filename: str) -> None:
    _send_with_retry(to, subject, html, attachment, filename)


def send_invoice_email(to: str, order_number: str, pdf_bytes: bytes) -> None:
    """Fire-and-forget — emails the invoice PDF as an attachment."""
    if not to:
        return
    html = _wrap(
        f"<h2>Invoice for Order {order_number}</h2>"
        f"<p>Thank you for your order! Your invoice is attached as a PDF.</p>"
    )
    threading.Thread(
        target=_send_with_attachment,
        args=(to, f"Invoice — Order {order_number}", html, pdf_bytes, f"invoice-{order_number}.pdf"),
        daemon=True,
    ).start()


# ─── Base template ────────────────────────────────────────────────────────────

def _wrap(content: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{{margin:0;padding:0;background:#F0F7FF;font-family:Arial,sans-serif;color:#042C53}}
.wrap{{max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(4,44,83,.1)}}
.hd{{background:#042C53;padding:28px 40px;text-align:center}}
.hd h1{{color:#fff;margin:0;font-size:22px;letter-spacing:1px}}
.hd p{{color:#B5D4F4;margin:6px 0 0;font-size:12px}}
.bd{{padding:28px 40px}}
h2{{color:#042C53;margin:0 0 6px}}
table.items{{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}}
table.items th{{background:#EEF5FF;padding:9px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px}}
table.items td{{padding:9px 10px;border-bottom:1px solid #E6F1FB}}
.total-row td{{font-weight:700;background:#EEF5FF}}
.badge{{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}}
.badge-green{{background:#D1FAE5;color:#065F46}}
.badge-blue{{background:#DBEAFE;color:#1E40AF}}
.badge-red{{background:#FEE2E2;color:#991B1B}}
.info-box{{background:#F0F7FF;border-radius:8px;padding:14px 16px;margin-top:20px;font-size:13px;line-height:1.7;color:#374151}}
.refund-box{{background:#FEF3C7;border-radius:8px;padding:14px 16px;margin-top:14px;font-size:13px;color:#92400E}}
.ft{{background:#EEF5FF;padding:18px 40px;text-align:center;font-size:11px;color:#6B7280;line-height:1.8}}
a{{color:#0C447C}}
</style></head>
<body><div class="wrap">
<div class="hd"><h1>Divya Luxury Seafoods</h1><p>Premium Imported Seafood &amp; Gourmet Foods</p></div>
<div class="bd">{content}</div>
<div class="ft">
  Divya Luxury Seafoods &middot; O-52, Saurabh Vihar, Jaitpur, Badarpur Extension, New Delhi&nbsp;&ndash;&nbsp;110044<br>
  +91&nbsp;9999123242 &middot; +91&nbsp;7303436108 &middot; salesdivyafoods@gmail.com &middot;
  <a href="https://www.divyafoods.com">www.divyafoods.com</a>
</div>
</div></body></html>"""


def _items_table(items: list, subtotal: float, delivery: float, discount: float, total: float, coupon: str = "") -> str:
    rows = "".join(
        f'<tr><td>{_esc(it["name"])}</td>'
        f'<td style="text-align:center">{it["quantity"]}</td>'
        f'<td style="text-align:right">&#8377;{it["price"]:,.2f}</td>'
        f'<td style="text-align:right">&#8377;{it["price"] * it["quantity"]:,.2f}</td></tr>'
        for it in items
    )
    disc_row = (
        f'<tr><td colspan="3" style="color:#059669">Discount ({coupon})</td>'
        f'<td style="text-align:right;color:#059669">&minus;&#8377;{discount:,.2f}</td></tr>'
    ) if discount else ""
    delivery_str = "FREE" if delivery == 0 else f"&#8377;{delivery:,.2f}"
    return f"""
<table class="items">
  <thead><tr>
    <th>Item</th><th style="text-align:center">Qty</th>
    <th style="text-align:right">Rate</th><th style="text-align:right">Amount</th>
  </tr></thead>
  <tbody>
    {rows}
    <tr><td colspan="3">Subtotal</td><td style="text-align:right">&#8377;{subtotal:,.2f}</td></tr>
    <tr><td colspan="3">Delivery</td><td style="text-align:right">{delivery_str}</td></tr>
    {disc_row}
    <tr class="total-row"><td colspan="3">Total</td><td style="text-align:right">&#8377;{total:,.2f}</td></tr>
  </tbody>
</table>"""


def _addr(a: dict) -> str:
    # Every field here is customer-supplied at checkout — escape before embedding
    # in HTML, or a malicious full_name/address could inject markup into the
    # admin's own inbox when this renders inside admin_new_order_notification().
    line2 = f', {_esc(a["address_line2"])}' if a.get("address_line2") else ""
    return (
        f'<strong>{_esc(a.get("full_name",""))}</strong><br>'
        f'{_esc(a.get("address_line1",""))}{line2}<br>'
        f'{_esc(a.get("city",""))}, {_esc(a.get("state",""))} &ndash; {_esc(a.get("pincode",""))}<br>'
        f'&#128222; {_esc(a.get("phone",""))}'
    )


# ─── Public email functions ───────────────────────────────────────────────────

def order_confirmation(order: dict, customer_email: str) -> None:
    # order is the camelCase dict from _order_to_dict
    a = order.get("deliveryAddress", {})
    html = _wrap(f"""
<h2>Order Confirmed! &#127881;</h2>
<p style="color:#6B7280;margin:0 0 18px">Hi {a.get("full_name","there")}, thank you for your order.</p>
<p><strong>Order Number:</strong> {order["orderNumber"]} &nbsp;
   <span class="badge badge-green">Confirmed</span></p>
<strong>Items Ordered</strong>
{_items_table(order["items"], order["subtotal"], order["deliveryCharge"],
              order.get("discount",0), order["total"], order.get("couponCode",""))}
<p style="margin:16px 0 6px"><strong>Delivering To</strong></p>
<p style="line-height:1.8;font-size:13px">{_addr(a)}</p>
<div class="info-box">
  &#128336; Your order will be processed within <strong>24 hours</strong>.<br>
  &#128230; Delivery in <strong>2&ndash;4 business days</strong> across Delhi NCR, Gurgaon &amp; Noida.<br>
  &#128172; Questions? Call <strong>+91&nbsp;9999123242</strong> or reply to this email.
</div>""")
    send_async(customer_email, f"Order Confirmed — {order['orderNumber']} | Divya Luxury Seafoods", html)


def order_shipped(order: dict, customer_email: str, note: str = "") -> None:
    a = order.get("deliveryAddress", {})
    note_html = f'<div class="info-box">&#128230; {note}</div>' if note else ""
    html = _wrap(f"""
<h2>Your Order Has Shipped! &#128666;</h2>
<p style="color:#6B7280;margin:0 0 18px">Hi {a.get("full_name","there")}, great news &mdash; your order is on its way.</p>
<p><strong>Order Number:</strong> {order["orderNumber"]} &nbsp;
   <span class="badge badge-blue">Shipped</span></p>
{note_html}
<p style="margin:16px 0 6px"><strong>Delivering To</strong></p>
<p style="line-height:1.8;font-size:13px">{_addr(a)}</p>
<div class="info-box">
  &#128230; Expected delivery within <strong>1&ndash;2 business days</strong>.<br>
  &#128222; For delivery queries call <strong>+91&nbsp;9999123242</strong>.
</div>""")
    send_async(customer_email, f"Shipped — {order['orderNumber']} | Divya Luxury Seafoods", html)


def order_delivered(order: dict, customer_email: str) -> None:
    a = order.get("deliveryAddress", {})
    html = _wrap(f"""
<h2>Order Delivered! &#9989;</h2>
<p style="color:#6B7280;margin:0 0 18px">Hi {a.get("full_name","there")}, your order has been delivered successfully.</p>
<p><strong>Order Number:</strong> {order["orderNumber"]} &nbsp;
   <span class="badge badge-green">Delivered</span></p>
<div class="info-box">
  &#128591; Thank you for shopping with Divya Luxury Seafoods!<br>
  &#11088; We hope you enjoy your premium imported products.<br>
  &#128172; Feedback? We&rsquo;d love to hear from you &mdash; simply reply to this email.
</div>""")
    send_async(customer_email, f"Delivered — {order['orderNumber']} | Divya Luxury Seafoods", html)


def order_cancelled(order: dict, customer_email: str, reason: str = "") -> None:
    a = order.get("deliveryAddress", {})
    refund_html = ""
    if order.get("paymentStatus") in ("paid", "refunded"):
        refund_html = (
            f'<div class="refund-box">&#128176; A refund of <strong>&#8377;{order["total"]:,.2f}</strong> '
            f'will be processed to your original payment method within <strong>5&ndash;7 business days</strong>.</div>'
        )
    reason_html = f'<p style="color:#6B7280;font-size:13px;margin:8px 0"><em>Reason: {reason}</em></p>' if reason else ""
    html = _wrap(f"""
<h2>Order Cancelled</h2>
<p style="color:#6B7280;margin:0 0 18px">Hi {a.get("full_name","there")}, your order has been cancelled as requested.</p>
<p><strong>Order Number:</strong> {order["orderNumber"]} &nbsp;
   <span class="badge badge-red">Cancelled</span></p>
{reason_html}
{refund_html}
<div class="info-box">
  &#128172; Questions? Call <strong>+91&nbsp;9999123242</strong> or reply to this email.<br>
  &#128722; <a href="https://www.divyafoods.com">Continue shopping</a> for premium imported foods.
</div>""")
    send_async(customer_email, f"Order Cancelled — {order['orderNumber']} | Divya Luxury Seafoods", html)


def order_processing(order: dict, customer_email: str) -> None:
    a = order.get("deliveryAddress", {})
    html = _wrap(f"""
<h2>We're Packing Your Order &#128230;</h2>
<p style="color:#6B7280;margin:0 0 18px">Hi {a.get("full_name","there")}, your order is now being packed and prepared for dispatch.</p>
<p><strong>Order Number:</strong> {order["orderNumber"]} &nbsp;
   <span class="badge badge-blue">Processing</span></p>
{_items_table(order["items"], order["subtotal"], order["deliveryCharge"],
              order.get("discount",0), order["total"], order.get("couponCode",""))}
<div class="info-box">
  &#128666; Your order will be dispatched soon — you'll get a shipping email with tracking details.<br>
  &#128222; Questions? Call <strong>+91&nbsp;9999123242</strong> or reply to this email.
</div>""")
    send_async(customer_email, f"Packing Your Order — {order['orderNumber']} | Divya Luxury Seafoods", html)


# ─── Auth emails ──────────────────────────────────────────────────────────────

SITE_URL = "https://divya-foods.vercel.app"


def welcome(name: str, customer_email: str) -> None:
    html = _wrap(f"""
<h2>Welcome to Divya Luxury Seafoods! &#127881;</h2>
<p style="color:#6B7280;margin:0 0 18px">Hi {name}, your account has been created successfully.</p>
<div class="info-box">
  &#127827; Browse our premium selection of <strong>imported frozen seafood</strong> from Norway, Japan, and beyond.<br>
  &#127869; Explore our <strong>Japanese grocery</strong> range &mdash; miso, nori, wasabi, and more.<br>
  &#128666; Free delivery on orders above &#8377;999 across Delhi NCR, Gurgaon &amp; Noida.
</div>
<p style="text-align:center;margin:24px 0">
  <a href="{SITE_URL}/products"
     style="background:#042C53;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
    Shop Now
  </a>
</p>
<p style="font-size:12px;color:#9CA3AF;text-align:center">
  Questions? Call <strong>+91&nbsp;9999123242</strong> or reply to this email.
</p>""")
    send_async(customer_email, "Welcome to Divya Luxury Seafoods!", html)


def password_reset(customer_email: str, reset_token: str) -> None:
    reset_url = f"{SITE_URL}/auth/reset-password?token={reset_token}"
    html = _wrap(f"""
<h2>Reset Your Password &#128274;</h2>
<p style="color:#6B7280;margin:0 0 18px">We received a request to reset the password for your Divya Luxury Seafoods account.</p>
<p style="text-align:center;margin:28px 0">
  <a href="{reset_url}"
     style="background:#042C53;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
    Reset Password
  </a>
</p>
<div class="info-box">
  &#9200; This link expires in <strong>1 hour</strong>.<br>
  &#128274; If you didn't request a password reset, you can safely ignore this email &mdash; your password won't change.
</div>
<p style="font-size:11px;color:#9CA3AF;margin-top:20px">
  If the button above doesn't work, copy and paste this link into your browser:<br>
  <a href="{reset_url}" style="color:#0C447C;word-break:break-all">{reset_url}</a>
</p>""")
    send_async(customer_email, "Reset Your Password — Divya Luxury Seafoods", html)


# ─── Refunds ──────────────────────────────────────────────────────────────────

def refund_processed(order: dict, customer_email: str, amount: float, full: bool, method: str = "razorpay") -> None:
    """Sent when a refund actually happens — Razorpay confirms it (webhook or an
    admin-triggered API call) or an admin records a manual one (bank transfer,
    UPI, cash — typically for a COD order Razorpay can't auto-refund). Not sent
    merely when a cancellation/return is *requested* — order_cancelled() and
    return_request_received() cover the request itself."""
    a = order.get("deliveryAddress", {})
    scope = "full" if full else "partial"
    if method == "razorpay":
        detail_html = f"""&#128176; <strong>&#8377;{amount:,.2f}</strong> has been refunded to your original payment method.<br>
  &#9200; It typically takes <strong>5&ndash;7 business days</strong> to reflect in your account."""
    else:
        detail_html = f"""&#128176; <strong>&#8377;{amount:,.2f}</strong> has been refunded to you directly by our team (bank transfer/UPI/cash)."""
    html = _wrap(f"""
<h2>Refund Processed &#128176;</h2>
<p style="color:#6B7280;margin:0 0 18px">Hi {a.get("full_name","there")}, a {scope} refund for your order has been processed.</p>
<p><strong>Order Number:</strong> {order["orderNumber"]} &nbsp;
   <span class="badge badge-blue">Refunded</span></p>
<div class="refund-box">
  {detail_html}
</div>
<div class="info-box">
  &#128172; Questions about this refund? Call <strong>+91&nbsp;9999123242</strong> or reply to this email.
</div>""")
    send_async(customer_email, f"Refund Processed — {order['orderNumber']} | Divya Luxury Seafoods", html)


def return_request_received(ret: dict, customer_email: str) -> None:
    """Confirms a return/refund request was received — the actual refund email
    (refund_processed) follows separately once an admin approves it."""
    rows = "".join(f'<li>{it["quantity"]}&times; {_esc(it["name"])}</li>' for it in ret.get("items", []))
    html = _wrap(f"""
<h2>Return Request Received &#128203;</h2>
<p style="color:#6B7280;margin:0 0 18px">We've received your return request for order
   <strong>{ret["orderNumber"]}</strong> and will review it shortly.</p>
<p style="margin:16px 0 6px"><strong>Items</strong></p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:13px">{rows}</ul>
<p><strong>Requested refund amount:</strong> &#8377;{ret["refundAmount"]:,.2f}</p>
<div class="info-box">
  &#8987; We typically review return requests within 1&ndash;2 business days.<br>
  &#128172; Questions? Call <strong>+91&nbsp;9999123242</strong> or reply to this email.
</div>""")
    send_async(customer_email, f"Return Request Received — {ret['orderNumber']} | Divya Luxury Seafoods", html)


def return_rejected(ret: dict, customer_email: str, note: str) -> None:
    safe_note = _esc(note)
    html = _wrap(f"""
<h2>Return Request Update</h2>
<p style="color:#6B7280;margin:0 0 18px">Your return request for order
   <strong>{ret["orderNumber"]}</strong> was not approved.</p>
<p style="margin:16px 0 6px"><strong>Reason from our team</strong></p>
<p style="font-size:13px;white-space:pre-wrap">{safe_note}</p>
<div class="info-box">
  &#128172; Questions? Call <strong>+91&nbsp;9999123242</strong> or reply to this email.
</div>""")
    send_async(customer_email, f"Return Request Update — {ret['orderNumber']} | Divya Luxury Seafoods", html)


# ─── Cart ─────────────────────────────────────────────────────────────────────

def abandoned_cart_reminder(items: list, customer_name: str, customer_email: str) -> None:
    """Sent once per abandonment by cart_service's scheduled job — items are
    the cart's own item dicts (productId/name/price/quantity), not an order."""
    rows = "".join(
        f'<li>{it["quantity"]}&times; {_esc(it["name"])} — &#8377;{it["price"] * it["quantity"]:,.2f}</li>'
        for it in items
    )
    total = sum(it["price"] * it["quantity"] for it in items)
    html = _wrap(f"""
<h2>You left something in your cart &#128717;</h2>
<p style="color:#6B7280;margin:0 0 18px">Hi {_esc(customer_name) or "there"}, your cart is still waiting for you.</p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:13px">{rows}</ul>
<p style="font-weight:600">Cart total: &#8377;{total:,.2f}</p>
<p style="text-align:center;margin:24px 0">
  <a href="{SITE_URL}/cart"
     style="background:#042C53;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
    Complete Your Order
  </a>
</p>
<div class="info-box">
  &#128666; Free delivery on orders above &#8377;999 across Delhi NCR, Gurgaon &amp; Noida.<br>
  &#128172; Questions? Call <strong>+91&nbsp;9999123242</strong> or reply to this email.
</div>""")
    send_async(customer_email, "You left something in your cart — Divya Luxury Seafoods", html)


# ─── Admin-facing notifications ───────────────────────────────────────────────

def admin_new_order_notification(order: dict) -> None:
    """Alerts the business owner's inbox the moment a paid order comes in —
    small operations don't have a dashboard open all day."""
    a = order.get("deliveryAddress", {})
    rows = "".join(f'<li>{it["quantity"]}&times; {_esc(it["name"])}</li>' for it in order.get("items", []))
    html = _wrap(f"""
<h2>New Order Received &#128229;</h2>
<p><strong>Order Number:</strong> {order["orderNumber"]} &nbsp;
   <span class="badge badge-green">&#8377;{order["total"]:,.2f}</span></p>
<p style="margin:16px 0 6px"><strong>Items</strong></p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:13px">{rows}</ul>
<p style="margin:16px 0 6px"><strong>Customer</strong></p>
<p style="line-height:1.8;font-size:13px">{_addr(a)}</p>""")
    send_async(settings.ADMIN_NOTIFICATION_EMAIL, f"New Order {order['orderNumber']} — ₹{order['total']:,.2f}", html)


def admin_return_request_notification(ret: dict) -> None:
    """Alerts the business owner's inbox when a customer requests a return —
    same reasoning as admin_new_order_notification: no dashboard open all day."""
    rows = "".join(f'<li>{it["quantity"]}&times; {_esc(it["name"])}</li>' for it in ret.get("items", []))
    reason_labels = {
        "wrong_item": "Wrong item delivered",
        "damaged_or_spoiled": "Damaged or spoiled on arrival",
        "missing_item": "Item missing from delivery",
        "other": "Other",
    }
    html = _wrap(f"""
<h2>New Return Request &#8617;</h2>
<p><strong>Order Number:</strong> {ret["orderNumber"]} &nbsp;
   <span class="badge badge-red">&#8377;{ret["refundAmount"]:,.2f}</span></p>
<p><strong>Reason:</strong> {_esc(reason_labels.get(ret["reason"], ret["reason"]))}</p>
{f'<p><strong>Customer note:</strong> {_esc(ret["note"])}</p>' if ret.get("note") else ""}
<p style="margin:16px 0 6px"><strong>Items</strong></p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:13px">{rows}</ul>
<p style="font-size:13px;color:#6B7280">Review in the admin panel under Returns.</p>""")
    send_async(settings.ADMIN_NOTIFICATION_EMAIL, f"Return Request — {ret['orderNumber']}", html)


def contact_form_submission(name: str, email: str, phone: str, message: str) -> None:
    """Relays a Contact Us form submission to the business inbox. Every field
    is public-form input — escaped before embedding in HTML."""
    safe_name, safe_email, safe_phone, safe_message = _esc(name), _esc(email), _esc(phone), _esc(message)
    html = _wrap(f"""
<h2>New Contact Form Submission &#9993;</h2>
<p style="margin:16px 0 6px"><strong>From</strong></p>
<p style="line-height:1.8;font-size:13px">
  {safe_name}<br>
  <a href="mailto:{safe_email}">{safe_email}</a><br>
  {safe_phone or "&mdash;"}
</p>
<p style="margin:16px 0 6px"><strong>Message</strong></p>
<p style="line-height:1.6;font-size:13px;white-space:pre-wrap">{safe_message}</p>""")
    send_async(settings.ADMIN_NOTIFICATION_EMAIL, f"Contact Form — {safe_name}", html)


def admin_low_stock_digest(products: list) -> None:
    """Daily digest (product_service.run_low_stock_digest_job) of every
    product at or below its own restock threshold — small operations don't
    have a dashboard open all day to notice this on their own. `products` are
    raw aggregation docs from product_service.get_low_stock_products, with
    computed _available/_threshold fields (not the camelCase API shape)."""
    count = len(products)
    rows = "".join(
        f'<li>{_esc(p["name"])} — {p["_available"]} left (threshold {p["_threshold"]})'
        f'{" <strong>&mdash; OUT OF STOCK</strong>" if p["_available"] <= 0 else ""}</li>'
        for p in products
    )
    html = _wrap(f"""
<h2>Low Stock Alert &#128230;</h2>
<p style="color:#6B7280;margin:0 0 18px">{count} product{'s' if count != 1 else ''} at or below their restock threshold:</p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:13px">{rows}</ul>
<p style="font-size:13px;color:#6B7280">Review and reorder from the admin panel's Inventory section.</p>""")
    send_async(settings.ADMIN_NOTIFICATION_EMAIL, f"Low Stock Alert — {count} product{'s' if count != 1 else ''}", html)
