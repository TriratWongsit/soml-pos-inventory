// ป้ายสถานะการชำระบนหน้าคิวและหน้ายืนยันจ่าย   [คอมเมนต์กรรมการ K-9]
// จ่ายด้วย QR แล้ว = เขียว · ขายเชื่อ (บิลเซ็น) = ส้ม พร้อมชื่อลูกค้า คลังจะรู้ว่าต้องให้ลูกค้าเซ็นบิล
export default function PayBadge({ order }) {
  if (order.payment_method === 'credit') {
    return <span className="badge pay-credit">ขายเชื่อ{order.customer_name ? ` · ${order.customer_name}` : ''}</span>;
  }
  if (order.payment_method === 'cash') return <span className="badge pay-qr">จ่ายแล้ว (เงินสด)</span>;
  return <span className="badge pay-qr">จ่ายแล้ว (QR)</span>;
}
