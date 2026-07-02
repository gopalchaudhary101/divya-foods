"""
Email service — HTML transactional emails via SMTP.

Sending is fire-and-forget (daemon thread) so it never blocks an HTTP response.
If SMTP credentials are missing the functions return immediately without error.
"""

import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


# ─── Core sender ──────────────────────────────────────────────────────────────

def _send(to: str, subject: str, html: str) -> None:
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        return  # SMTP not configured — skip silently
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = settings.EMAIL_FROM
        msg["To"]      = to
        msg.attach(MIMEText(html, "html", "utf-8"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as srv:
            srv.ehlo()
            srv.starttls()
            srv.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            srv.sendmail(settings.EMAIL_FROM, to, msg.as_string())
        print(f"[email] Sent '{subject}' to {to}")
    except Exception as exc:
        print(f"[email] Failed to send to {to}: {exc}")


def send_async(to: str, subject: str, html: str) -> None:
    """Fire-and-forget — spawns a daemon thread."""
    if not to:
        return
    threading.Thread(target=_send, args=(to, subject, html), daemon=True).start()


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
<div class="hd"><h1>Divya Foods</h1><p>Premium Imported Seafood &amp; Gourmet Foods</p></div>
<div class="bd">{content}</div>
<div class="ft">
  Divya Foods &middot; O-52, Saurabh Vihar, Jaitpur, Badarpur Extension, New Delhi&nbsp;&ndash;&nbsp;110044<br>
  +91&nbsp;9999123242 &middot; +91&nbsp;7303436108 &middot; salesdivyafoods@gmail.com &middot;
  <a href="https://www.divyafoods.com">www.divyafoods.com</a>
</div>
</div></body></html>"""


def _items_table(items: list, subtotal: float, delivery: float, discount: float, total: float, coupon: str = "") -> str:
    rows = "".join(
        f'<tr><td>{it["name"]}</td>'
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
    line2 = f', {a["address_line2"]}' if a.get("address_line2") else ""
    return (
        f'<strong>{a.get("full_name","")}</strong><br>'
        f'{a.get("address_line1","")}{line2}<br>'
        f'{a.get("city","")}, {a.get("state","")} &ndash; {a.get("pincode","")}<br>'
        f'&#128222; {a.get("phone","")}'
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
    send_async(customer_email, f"Order Confirmed — {order['orderNumber']} | Divya Foods", html)


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
    send_async(customer_email, f"Shipped — {order['orderNumber']} | Divya Foods", html)


def order_delivered(order: dict, customer_email: str) -> None:
    a = order.get("deliveryAddress", {})
    html = _wrap(f"""
<h2>Order Delivered! &#9989;</h2>
<p style="color:#6B7280;margin:0 0 18px">Hi {a.get("full_name","there")}, your order has been delivered successfully.</p>
<p><strong>Order Number:</strong> {order["orderNumber"]} &nbsp;
   <span class="badge badge-green">Delivered</span></p>
<div class="info-box">
  &#128591; Thank you for shopping with Divya Foods!<br>
  &#11088; We hope you enjoy your premium imported products.<br>
  &#128172; Feedback? We&rsquo;d love to hear from you &mdash; simply reply to this email.
</div>""")
    send_async(customer_email, f"Delivered — {order['orderNumber']} | Divya Foods", html)


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
    send_async(customer_email, f"Order Cancelled — {order['orderNumber']} | Divya Foods", html)
