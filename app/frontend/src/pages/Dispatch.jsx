// หน้าจอยืนยันการจ่ายสินค้า   [FR-05, FR-06 · UC-07 · รูปที่ 3.17]
//
// เป็นจุดที่ระบบเรียกร้องความระมัดระวังสูงสุดจากผู้ใช้ จึงบังคับให้ทำเครื่องหมาย
// กำกับทุกรายการก่อนกดยืนยัน และมีขั้นตอนยืนยันซ้ำก่อนดำเนินการจริง
// ตามที่อธิบายไว้ในหัวข้อ 3.8.3 และข้อกำหนดใน SRS §3.1.1
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api, baht, int } from '../api.js';

export default function Dispatch() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [checked, setChecked] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get(`/orders/${orderId}`).then((r) => setOrder(r.order)).catch((e) => setError(e.message));
  }, [orderId]);

  const allChecked = order && order.items.every((i) => checked[i.product_id]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      setDone(await api.post(`/orders/${orderId}/dispatch`));
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Layout title="จ่ายสินค้าสำเร็จ">
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="alert ok"><span className="t">จ่ายสินค้าตามคำสั่งซื้อ {done.orderNo} เรียบร้อย</span></div>
          <table>
            <thead><tr><th>สินค้า</th><th className="num">จ่ายออก</th><th className="num">คงเหลือ</th></tr></thead>
            <tbody>
              {done.movements.map((m) => (
                <tr key={m.productId}>
                  <td>{m.name}</td>
                  <td className="num">{int(m.qty)}</td>
                  <td className="num">{int(m.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {done.alerts.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {done.alerts.map((a) => (
                <div className="alert warn" key={a.notificationId}><span>{a.message}</span></div>
              ))}
            </div>
          )}
          <button className="btn big" style={{ marginTop: 14 }} onClick={() => navigate('/queue')}>กลับไปหน้าคิว</button>
        </div>
      </Layout>
    );
  }

  if (!order) {
    return <Layout title="ยืนยันการจ่ายสินค้า">{error ? <div className="alert crit"><span>{error}</span></div> : <div className="muted">กำลังโหลด…</div>}</Layout>;
  }

  const dispatched = order.status === 'delivered';

  return (
    <Layout title={`ยืนยันการจ่ายสินค้า · ${order.order_no}`}>
      {error && <div className="alert crit"><span>{error}</span></div>}

      {dispatched ? (
        <div className="alert crit"><span className="t">คำสั่งซื้อนี้ถูกจ่ายสินค้าไปแล้ว</span></div>
      ) : (
        <div className="alert warn">
          <span>เมื่อกดยืนยันแล้วระบบจะตัดสต็อกทันทีและ<b>ยืนยันซ้ำไม่ได้อีก</b> กรุณาตรวจนับสินค้าให้ครบทุกรายการก่อน</span>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              {!dispatched && <th style={{ width: 52 }}>ตรวจ</th>}
              <th>สินค้า</th>
              <th className="num">{dispatched ? 'จำนวนที่จ่ายไป' : 'จำนวนที่ต้องจ่าย'}</th>
              <th className="num">คงเหลือปัจจุบัน</th>
              {/* คอลัมน์คาดการณ์มีความหมายเฉพาะก่อนจ่ายสินค้า เมื่อจ่ายไปแล้ว
                  สต็อกถูกหักเรียบร้อย การนำมาลบซ้ำจะได้ตัวเลขติดลบที่ไม่จริง */}
              {!dispatched && <th className="num">คงเหลือหลังจ่าย</th>}
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.product_id}>
                {!dispatched && (
                  <td>
                    <input type="checkbox" checked={!!checked[i.product_id]}
                           aria-label={`ตรวจนับ ${i.name}`}
                           onChange={(e) => setChecked((c) => ({ ...c, [i.product_id]: e.target.checked }))} />
                  </td>
                )}
                <td>{i.name}<div className="muted">{i.sku}</div></td>
                <td className="num"><b>{int(i.qty)}</b> {i.unit}</td>
                <td className="num">{int(i.stock_qty)}</td>
                {!dispatched && (
                  <td className="num" style={{ color: i.stockAfterDispatch < 0 ? '#b3352f' : undefined }}>
                    {int(i.stockAfterDispatch)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="total"><span>ยอดรวมทั้งสิ้น</span><b>{baht(order.total_amount)} ฿</b></div>
      </div>

      {!dispatched && (
        <div className="card">
          {confirming ? (
            <>
              <div className="alert crit">
                <span className="t">ยืนยันอีกครั้ง — ตัดสต็อกตามคำสั่งซื้อ {order.order_no} หรือไม่?</span>
              </div>
              <button className="btn green" onClick={confirm} disabled={busy}>
                {busy ? 'กำลังตัดสต็อก…' : 'ยืนยัน ตัดสต็อกเลย'}
              </button>
              <button className="btn ghost" style={{ marginLeft: 10 }} onClick={() => setConfirming(false)} disabled={busy}>
                ยกเลิก
              </button>
            </>
          ) : (
            <>
              <button className="btn big green" disabled={!allChecked} onClick={() => setConfirming(true)}>
                ยืนยันจ่ายสินค้าและตัดสต็อก
              </button>
              {!allChecked && <div className="muted" style={{ marginTop: 8, textAlign: 'center' }}>ต้องทำเครื่องหมายตรวจนับให้ครบทุกรายการก่อน</div>}
            </>
          )}
        </div>
      )}

      <button className="btn ghost" onClick={() => navigate('/queue')}>กลับไปหน้าคิว</button>
    </Layout>
  );
}
