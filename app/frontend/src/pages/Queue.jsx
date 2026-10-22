// หน้าจอคิวรอจ่ายสินค้า   [FR-04 · UC-05, UC-06 · รูปที่ 3.16 และ 3.19]
//
// อัปเดตอัตโนมัติเมื่อได้รับเหตุการณ์จากเซิร์ฟเวอร์ ผู้ใช้ไม่ต้องกดรีเฟรช
// ตามข้อกำหนดใน SRS §3.1.1 และเกณฑ์เวลาใน NFR-02
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api, baht, int, waitLevel } from '../api.js';
import { useRealtime } from '../realtime.js';

export default function Queue() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [, setTick] = useState(0);
  const navigate = useNavigate();

  const reload = useCallback(() => {
    api.get('/queue').then((r) => setOrders(r.orders)).catch((e) => setError(e.message));
  }, []);

  useEffect(reload, [reload]);

  // ดึงรายการใหม่เมื่อมีคำสั่งซื้อเข้าหรือออกจากคิว
  const channel = useRealtime((evt) => {
    if (['order.created', 'order.dispatched', 'order.status_changed'].includes(evt.type)) reload();
  });

  // เดินเวลารอทุกสิบวินาที เพื่อให้สีของคอลัมน์เวลารอเปลี่ยนตามจริง
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const goods = (o) => o.items.map((i) => `${i.name} ${int(i.qty)} ${i.unit}`).join(' · ');

  /**
   * ปรับสถานะการจัดของ   [UC-06]
   *
   * พนักงานกดเมื่อเริ่มหยิบของ เพื่อให้เพื่อนร่วมงานที่เปิดหน้าจอเดียวกันเห็นว่า
   * รายการนี้มีคนดูแลอยู่แล้ว ไม่ต้องหยิบซ้ำ  รายการจะกลับเป็นรอจ่ายสินค้าได้
   * ถ้ากดยกเลิก ตามเส้นทางที่แผนภาพสถานะในรูปที่ 3.13 อนุญาต
   */
  const setStatus = async (orderId, status) => {
    setError(null);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const PickingButton = ({ order }) =>
    order.status === 'picking' ? (
      <button className="btn ghost small" onClick={() => setStatus(order.order_id, 'awaiting_dispatch')}>
        ยกเลิกการจัดของ
      </button>
    ) : (
      <button className="btn ghost small" onClick={() => setStatus(order.order_id, 'picking')}>
        เริ่มจัดของ
      </button>
    );

  return (
    <Layout
      title="คิวรอจ่ายสินค้า"
      actions={
        <span className={`pill ${channel ? '' : 'gray'}`}>
          <i className="dot" />
          {channel === 'websocket' ? 'อัปเดตอัตโนมัติ' : channel === 'sse' ? 'อัปเดตอัตโนมัติ (ช่องทางสำรอง)' : 'ไม่ได้เชื่อมต่อ'}
        </span>
      }
    >
      {error && <div className="alert crit"><span>{error}</span></div>}
      <div className="note">หน้าจอนี้อัปเดตรายการใหม่ให้อัตโนมัติ ไม่ต้องกดรีเฟรช</div>

      <div className="card">
        <h2>รอจ่ายสินค้า {orders.length} รายการ</h2>

        {orders.length === 0 ? (
          <div className="muted">ไม่มีคำสั่งซื้อรอจ่ายในขณะนี้</div>
        ) : (
          <>
            {/* มุมมองตารางสำหรับจอกว้าง */}
            <table className="qtable">
              <thead>
                <tr>
                  <th>เลขที่คำสั่งซื้อ</th><th>เวลารอ</th><th>รายการสินค้า</th>
                  <th className="num">ยอดรวม</th><th>สถานะ</th><th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const w = waitLevel(o.waited_seconds);
                  return (
                    <tr key={o.order_id}>
                      <td><b>{o.order_no}</b></td>
                      <td><span className={`wait ${w.level}`}>{w.text}</span></td>
                      <td>{goods(o)}</td>
                      <td className="num">{baht(o.total_amount)}</td>
                      <td>
                        <span className={`pill ${o.status === 'picking' ? 'info' : 'warn'}`}>
                          {o.status === 'picking' ? 'กำลังจัดของ' : 'รอจ่ายสินค้า'}
                        </span>
                      </td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        <PickingButton order={o} />{' '}
                        <button className="btn small" onClick={() => navigate(`/queue/${o.order_id}`)}>เปิดรายการ</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* มุมมองการ์ดสำหรับสมาร์ตโฟน ตามรูปที่ 3.19 (NFR-03) */}
            <div className="qcards">
              {orders.map((o) => {
                const w = waitLevel(o.waited_seconds);
                return (
                  <div key={o.order_id} className={`item ${o.status === 'picking' ? 'picking' : ''} ${w.level === 'bad' ? 'urgent' : ''}`}>
                    <div className="hd">
                      <span className="no">{o.order_no}</span>
                      <span className={`wait ${w.level}`}>{w.text}</span>
                    </div>
                    <div className="goods">{goods(o)}</div>
                    <div className="ft">
                      <span className={`pill ${o.status === 'picking' ? 'info' : 'warn'}`}>
                        {o.status === 'picking' ? 'กำลังจัดของ' : 'รอจ่ายสินค้า'}
                      </span>
                      <span style={{ display: 'flex', gap: 8 }}>
                        <PickingButton order={o} />
                        <button className="btn small" onClick={() => navigate(`/queue/${o.order_id}`)}>เปิดรายการ</button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
