// รายงานการขายรายวัน (ผู้จัดการ)                              [คอมเมนต์กรรมการ K-10 · UC-14 · FR-12]
//
// เลือกวันที่ → ทุกใบของวันนั้น ยอดแยก QR กับขายเชื่อ ใบที่ยกเลิก และเงินรับชำระหนี้ของวัน
// ปุ่มพิมพ์ใช้หน้าต่างพิมพ์ของเบราว์เซอร์ (จัดหน้า A4 ด้วย @media print เลือก "บันทึกเป็น PDF" ได้)
// ปุ่ม CSV ให้นักบัญชีเปิดใน Excel ใช้ทำภาษี
import { useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import { baht } from '../../components/Money.jsx';
import { api } from '../../services/api.js';

const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const time = (d) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const METHOD = { promptpay: 'QR พร้อมเพย์', cash: 'เงินสด', credit: 'ขายเชื่อ' };
const PAY = { cash: 'เงินสด', promptpay: 'QR พร้อมเพย์', transfer: 'โอนเงิน' };
const STATUS = { awaiting_dispatch: 'รอจ่าย', picking: 'กำลังจัด', delivered: 'ส่งมอบแล้ว', cancelled: 'ยกเลิก' };

function downloadCsv(r) {
  const rows = [['เลขที่', 'เวลา', 'วิธีชำระ', 'ลูกค้า', 'สถานะ', 'พนักงานขาย', 'ยอด (บาท)']];
  for (const o of r.orders) rows.push([o.order_no, time(o.paid_at), METHOD[o.payment_method], o.customer_name || '', STATUS[o.status], o.cashier, o.total_amount.toFixed(2)]);
  rows.push([], ['ยอดขาย (ไม่รวมยกเลิก)', '', '', '', '', '', r.summary.revenue.toFixed(2)],
    ['QR พร้อมเพย์', '', '', '', '', '', r.summary.promptpay.amount.toFixed(2)], ['เงินสด', '', '', '', '', '', r.summary.cash.amount.toFixed(2)],
    ['ขายเชื่อ', '', '', '', '', '', r.summary.credit.amount.toFixed(2)], ['เงินสดในลิ้นชัก', '', '', '', '', '', r.summary.cashInDrawer.toFixed(2)],
    ['รับชำระหนี้ขายเชื่อ', '', '', '', '', '', r.summary.creditPaymentsReceived.toFixed(2)], ['เงินเข้าจริง', '', '', '', '', '', r.summary.moneyIn.toFixed(2)]);
  const csv = '﻿' + rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');  // BOM ให้ Excel อ่านภาษาไทยถูก
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `รายงานขาย_${r.date}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ReportDaily() {
  const [date, setDate] = useState(localDate());
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get(`/reports/daily?date=${date}`).then((x) => { setR(x); setError(null); }).catch((e) => setError(e.message)); }, [date]);

  const s = r?.summary;
  return (
    <Layout title="รายงานการขายรายวัน" actions={r && (
      <span className="no-print" style={{ display: 'flex', gap: 8 }}>
        <button className="btn small" onClick={() => window.print()}>พิมพ์รายงาน</button>
        <button className="btn small ghost" onClick={() => downloadCsv(r)}>ดาวน์โหลด CSV</button>
      </span>
    )}>
      <div className="card no-print" style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
        <label htmlFor="d">วันที่</label>
        <input id="d" type="date" value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} />
      </div>
      {error && <div className="alert crit">{error}</div>}
      {r && (
        <div className="card">
          <div className="print-only"><h2>ร้านอำพรคอนกรีต · รายงานการขายประจำวันที่ {new Date(r.date).toLocaleDateString('th-TH', { dateStyle: 'long' })}</h2></div>
          <div className="report-sum">
            <div><small>ยอดขาย ({s.orders} ใบ)</small><b>{baht(s.revenue)} ฿</b></div>
            <div><small>QR พร้อมเพย์ ({s.promptpay.orders} ใบ)</small><b>{baht(s.promptpay.amount)} ฿</b></div>
            <div><small>เงินสด ({s.cash.orders} ใบ)</small><b>{baht(s.cash.amount)} ฿</b></div>
            <div><small>ขายเชื่อ ({s.credit.orders} ใบ)</small><b>{baht(s.credit.amount)} ฿</b></div>
            <div><small>เงินสดที่ควรอยู่ในลิ้นชัก</small><b>{baht(s.cashInDrawer)} ฿</b></div>
            <div><small>รับชำระหนี้ขายเชื่อ</small><b>{baht(s.creditPaymentsReceived)} ฿</b></div>
            <div><small>เงินเข้าจริงวันนี้</small><b>{baht(s.moneyIn)} ฿</b></div>
            <div><small>ยกเลิก ({s.cancelled.orders} ใบ)</small><b>{baht(s.cancelled.amount)} ฿</b></div>
          </div>
          <h2>รายการขาย</h2>
          <table>
            <thead><tr><th>เลขที่</th><th>เวลา</th><th>วิธีชำระ</th><th>ลูกค้า</th><th>สถานะ</th><th>พนักงานขาย</th><th className="num">ยอด</th></tr></thead>
            <tbody>
              {r.orders.map((o) => (
                <tr key={o.order_id} style={o.status === 'cancelled' ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
                  <td>{o.order_no}</td><td>{time(o.paid_at)}</td><td>{METHOD[o.payment_method]}</td><td>{o.customer_name || '-'}</td>
                  <td>{STATUS[o.status]}</td><td>{o.cashier}</td><td className="num">{baht(o.total_amount)}</td>
                </tr>
              ))}
              {r.orders.length === 0 && <tr><td colSpan="7" className="muted">ไม่มีการขายในวันนี้</td></tr>}
            </tbody>
          </table>
          {r.payments.length > 0 && (
            <>
              <h2 style={{ marginTop: 16 }}>รับชำระหนี้ขายเชื่อ</h2>
              <table>
                <thead><tr><th>เวลา</th><th>เลขที่ใบขายเชื่อ</th><th>ลูกค้า</th><th>วิธีรับเงิน</th><th className="num">จำนวน</th></tr></thead>
                <tbody>{r.payments.map((p) => <tr key={p.payment_id}><td>{time(p.received_at)}</td><td>{p.order_no}</td><td>{p.customer_name}</td><td>{PAY[p.method]}</td><td className="num">{baht(p.amount)}</td></tr>)}</tbody>
              </table>
            </>
          )}
          <div className="print-only muted" style={{ marginTop: 12 }}>พิมพ์จากระบบอำพร OMS เมื่อ {new Date(r.generatedAt).toLocaleString('th-TH')}</div>
        </div>
      )}
    </Layout>
  );
}
