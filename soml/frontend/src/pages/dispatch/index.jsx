// หน้ายืนยันจ่ายสินค้า                      [ตารางที่ 3.15 หน้าจอ 4 · ตารางที่ 3.21 · UC-07 · 3.9.1 ข้อสาม]
//
// งานเดียว: เห็นรายการที่ต้องจัด → ยืนยัน → ยืนยันซ้ำ → จ่าย
// การจ่ายทำให้สถานะเป็น delivered ซึ่งย้อนกลับไม่ได้ (ตาราง 3.20) จึงต้องยืนยันสองครั้ง
// ปุ่มใหญ่กดด้วยนิ้วได้แม้สวมถุงมือ (3.9.3) · ผลจากหลังบ้าน: ALREADY_DISPATCHED / INSUFFICIENT_STOCK แสดงตรง ๆ
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import { baht, int } from '../../components/Money.jsx';
import { api } from '../../services/api.js';

export default function Dispatch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [arming, setArming] = useState(false); // กดครั้งแรกแล้ว รอกดยืนยันซ้ำ
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.get(`/orders/${id}`).then((r) => setOrder(r.order)).catch((e) => setError(e.message)); }, [id]);

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api.post(`/orders/${id}/dispatch`);
      setResult(r);
    } catch (e) {
      setError(e.message); setArming(false);
      if (e.code === 'ALREADY_DISPATCHED') api.get(`/orders/${id}`).then((r) => setOrder(r.order)).catch(() => {});
    } finally { setBusy(false); }
  };

  if (!order && !error) return <Layout title="ยืนยันจ่ายสินค้า"><div className="muted">กำลังโหลด…</div></Layout>;

  if (result) {
    return (
      <Layout title="จ่ายสินค้าเรียบร้อย">
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="alert ok"><b>{result.order.orderNo}</b> ส่งมอบสำเร็จ — ตัดสต็อกแล้ว</div>
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>สินค้า</th><th className="num">จ่าย</th><th className="num">คงเหลือ</th></tr></thead>
            <tbody>{result.items.map((i) => <tr key={i.productId}><td>{i.name}</td><td className="num">{int(i.qty)}</td><td className="num">{int(i.balanceAfter)}</td></tr>)}</tbody>
          </table>
          <button className="btn big green" style={{ marginTop: 16 }} onClick={() => navigate('/queue')}>กลับไปหน้าคิว</button>
        </div>
      </Layout>
    );
  }

  const done = order && !['awaiting_dispatch', 'picking'].includes(order.status);
  const short = order?.items.filter((i) => i.stock_qty < i.qty) || [];

  return (
    <Layout title="ยืนยันจ่ายสินค้า">
      <div className="card" style={{ maxWidth: 560 }}>
        {error && <div className="alert crit">{error}</div>}
        {order && (
          <>
            <div className="qhead"><b className="qno">{order.order_no}</b><small className="muted">ขายโดย {order.created_by_name}</small></div>
            <table style={{ margin: '12px 0' }}>
              <thead><tr><th>สินค้า</th><th className="num">จำนวนที่ต้องจัด</th><th className="num">ในคลัง</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.product_id} className={i.stock_qty < i.qty ? 'short' : ''}>
                    <td>{i.name}<br /><small className="muted">{i.sku}</small></td>
                    <td className="num big-num">{int(i.qty)} {i.unit}</td>
                    <td className="num">{int(i.stock_qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="total"><span>ยอดชำระแล้ว</span><b>{baht(order.total_amount)} ฿</b></div>

            {done ? (
              <div className="alert warn" style={{ marginTop: 12 }}>คำสั่งซื้อนี้{order.status === 'delivered' ? 'ถูกจ่ายไปแล้ว' : 'ถูกยกเลิกแล้ว'} ไม่สามารถจ่ายซ้ำได้</div>
            ) : short.length > 0 ? (
              <div className="alert crit" style={{ marginTop: 12 }}>สต็อกไม่พอ: {short.map((i) => i.name).join(', ')} — แจ้งผู้จัดการปรับสต็อกก่อน</div>
            ) : !arming ? (
              <button className="btn big green" style={{ marginTop: 16 }} onClick={() => setArming(true)}>ยืนยันจ่ายสินค้า</button>
            ) : (
              <div className="confirm-box">
                <div><b>ยืนยันอีกครั้ง</b> — จ่ายสินค้าและตัดสต็อก ย้อนกลับไม่ได้</div>
                <button className="btn big red" onClick={confirm} disabled={busy}>{busy ? 'กำลังจ่าย…' : 'ยืนยัน จ่ายสินค้าเลย'}</button>
                <button className="btn ghost" style={{ width: '100%' }} onClick={() => setArming(false)} disabled={busy}>ยังก่อน</button>
              </div>
            )}
          </>
        )}
        <button className="btn ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => navigate('/queue')}>‹ กลับหน้าคิว</button>
      </div>
    </Layout>
  );
}
