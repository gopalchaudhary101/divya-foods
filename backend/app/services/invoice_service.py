"""
Invoice PDF generation — reportlab (already pulled in transitively by Pillow/Cloudinary
for QR support; added as an explicit dependency since we now use it directly).

generate_invoice_pdf() takes the same camelCase order dict order_service._order_to_dict()
already produces, plus the site settings dict from settings_service, and returns raw PDF
bytes — no new order/settings fetching logic duplicated here.

No per-line-item GST rate exists anywhere in the product/order data model, so the invoice
displays the business's GSTIN for compliance but does not fabricate a GST breakdown that
isn't backed by real rate data — prices are shown as agreed at checkout.
"""

from io import BytesIO

from reportlab.graphics.barcode import code128
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

_INK = colors.HexColor("#042C53")
_LIGHT = colors.HexColor("#EEF5FF")


def _qr_drawing(payload: str, size: float = 28 * mm) -> Drawing:
    widget = QrCodeWidget(payload)
    bounds = widget.getBounds()
    w, h = bounds[2] - bounds[0], bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    drawing.add(widget)
    return drawing


def _barcode(value: str) -> code128.Code128:
    # Code128 is itself a reportlab Flowable (has wrap/drawOn), so it can be
    # dropped straight into a platypus Table cell — no Drawing wrapper needed.
    return code128.Code128(value, barHeight=12 * mm, barWidth=0.35 * mm)


def generate_invoice_pdf(order: dict, settings_data: dict) -> bytes:
    """
    order: camelCase dict from order_service._order_to_dict()
    settings_data: camelCase dict from settings_service._to_dict() (businessName/gstNumber/fssaiNumber)
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
        title=f"Invoice {order['orderNumber']}",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("InvoiceTitle", parent=styles["Title"], textColor=_INK, fontSize=20, spaceAfter=0)
    label_style = ParagraphStyle("Label", parent=styles["Normal"], textColor=colors.grey, fontSize=8, leading=11)
    normal_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=14)
    small_style = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, textColor=colors.grey, leading=11)

    addr = order["deliveryAddress"]
    story = []

    # ── Header: company + invoice meta ────────────────────────────────────────
    header_table = Table([
        [
            Paragraph(f"<b>{settings_data.get('businessName', 'Divya Foods')}</b>", title_style),
            Paragraph(
                f"<b>TAX INVOICE</b><br/>Invoice No: <b>{order['orderNumber']}</b><br/>"
                f"Date: {order['createdAt'][:10]}<br/>"
                f"Payment: <b>{order['paymentStatus'].upper()}</b> ({order['paymentMethod']})",
                normal_style,
            ),
        ],
    ], colWidths=[100 * mm, 72 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"GSTIN: {settings_data.get('gstNumber', '—')} &nbsp;&nbsp; FSSAI: {settings_data.get('fssaiNumber', '—')}",
        small_style,
    ))
    story.append(Spacer(1, 14))

    # ── Bill-to ────────────────────────────────────────────────────────────────
    story.append(Paragraph("BILL TO", label_style))
    story.append(Paragraph(
        f"<b>{addr.get('fullName') or addr.get('full_name', '')}</b><br/>"
        f"{addr.get('phone', '')}<br/>"
        f"{addr.get('addressLine1') or addr.get('address_line1', '')}"
        + (f", {addr.get('addressLine2') or addr.get('address_line2')}" if (addr.get('addressLine2') or addr.get('address_line2')) else "")
        + f"<br/>{addr.get('city', '')}, {addr.get('state', '')} — {addr.get('pincode', '')}",
        normal_style,
    ))
    story.append(Spacer(1, 16))

    # ── Items table ────────────────────────────────────────────────────────────
    rows = [["#", "Item", "Qty", "Unit Price", "Amount"]]
    for i, item in enumerate(order["items"], start=1):
        rows.append([
            str(i), item["name"], str(item["quantity"]),
            f"Rs. {item['price']:.2f}", f"Rs. {item['price'] * item['quantity']:.2f}",
        ])
    items_table = Table(rows, colWidths=[10 * mm, 82 * mm, 15 * mm, 30 * mm, 35 * mm])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), _LIGHT),
        ("TEXTCOLOR", (0, 0), (-1, 0), _INK),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E6F1FB")),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 10))

    # ── Totals ─────────────────────────────────────────────────────────────────
    totals_rows = [["Subtotal", f"Rs. {order['subtotal']:.2f}"]]
    if order.get("discount"):
        coupon = f" ({order['couponCode']})" if order.get("couponCode") else ""
        totals_rows.append([f"Discount{coupon}", f"- Rs. {order['discount']:.2f}"])
    totals_rows.append([
        "Delivery Charge",
        "FREE" if order["deliveryCharge"] == 0 else f"Rs. {order['deliveryCharge']:.2f}",
    ])
    totals_rows.append(["Grand Total", f"Rs. {order['total']:.2f}"])

    totals_table = Table(totals_rows, colWidths=[137 * mm, 35 * mm])
    totals_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, _INK),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 11),
        ("TEXTCOLOR", (0, -1), (-1, -1), _INK),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 24))

    if order.get("notes"):
        story.append(Paragraph(f"<b>Note:</b> {order['notes']}", small_style))
        story.append(Spacer(1, 10))

    # ── QR + barcode footer ────────────────────────────────────────────────────
    qr_payload = f"Invoice {order['orderNumber']} | Total Rs.{order['total']:.2f} | {settings_data.get('businessName', 'Divya Foods')}"
    footer_table = Table([[
        _qr_drawing(qr_payload),
        _barcode(order["orderNumber"].replace(" ", "")),
    ]], colWidths=[40 * mm, 90 * mm])
    footer_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(footer_table)
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "Prices are inclusive of applicable taxes. This is a computer-generated invoice "
        "and does not require a signature. Thank you for shopping with us!",
        small_style,
    ))

    doc.build(story)
    return buf.getvalue()
