// หน้าขายหน้าร้าน                                  [ตารางที่ 3.15 หน้าจอ 2 · ตารางที่ 3.21 · UC-03 · รูปที่ 3.10]
//
// งานเดียว: เลือกสินค้า → ยอดรวม → QR → ยืนยันรับชำระ (3.9.1 ข้อแรก)
// สามขั้นบนหน้าจอเดียว: cart → payment → done
//   cart     ค้นหา/เพิ่มสินค้า แก้จำนวน เห็นยอดรวม (ยอดคำนวณจากหลังบ้านเสมอ ผ่าน /orders/quote)
//   payment  แสดง QR ตามยอด · ปุ่ม "ยืนยันรับชำระเงิน" = จุดเดียวที่คำสั่งซื้อถูกบันทึก (BR-01)
//   done     เลขที่คำสั่งซื้อ + ผลการพิมพ์ (พิมพ์ล้มไม่ทำให้การขายล้ม — UC-03 ทางที่ล้มเหลว)
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Layout from '../../components/Layout.jsx';
import { baht, int } from '../../components/Money.jsx';
import { api } from '../../services/api.js';

export default function Pos() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');   // '' = ทุกหมวด
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);           // [{ productId, sku, name, unit, price, qty }]
  const [quote, setQuote] = useState(null);       // ยอดจากหลังบ้าน
  const [step, setStep] = useState('cart');
  const [qrImage, setQrImage] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const searchBox = useRef(null);

  // ค้นหาสินค้า — เลือกหมวดก่อนแล้วค่อยพิมพ์ค้น (ตาราง 3.21) · รอพิมพ์เสร็จ 200 ms ค่อยถาม
  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`)
        .then((r) => { setResults(r.products.slice(0, 40)); setCategories(r.categories); })
        .catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [q, category]);

  // ทุกครั้งที่ตะกร้าเปลี่ยน ให้หลังบ้านคิดยอดใหม่ — ราคาบนหน้าจอเป็นแค่ตัวช่วยดู ราคาจริงอยู่ที่ฐาน
  useEffect(() => {
    if (cart.length === 0) { setQuote(null); return; }
    api.post('/orders/quote', { items: cart.map((i) => ({ productId: i.productId, qty: i.qty })) })
      .then((r) => { setQuote(r); setError(null); })
      .catch((e) => setError(e.message));
  }, [cart]);

  useEffect(() => {
    if (step === 'payment' && quote?.qrPayload) {
      QRCode.toDataURL(quote.qrPayload, { margin: 0, width: 440, errorCorrectionLevel: 'M' }).then(setQrImage);
    }
  }, [step, quote]);

  const add = (p) => {
    setCart((prev) => {
      const found = prev.find((i) => i.productId === p.product_id);
      if (found) return prev.map((i) => (i.productId === p.product_id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { productId: p.product_id, sku: p.sku, name: p.name, unit: p.unit, price: p.price, qty: 1 }];
    });
    setQ(''); searchBox.current?.focus();
  };
  const setQty = (productId, qty) =>
    setCart((prev) => (qty <= 0 ? prev.filter((i) => i.productId !== productId) : prev.map((i) => (i.productId === productId ? { ...i, qty } : i))));
  const reset = () => { setCart([]); setQuote(null); setStep('cart'); setQrImage(null); setResult(null); setError(null); };

  /** ยืนยันรับชำระเงิน — จุดเดียวที่คำสั่งซื้อถูกบันทึก พิมพ์ใบเสร็จ และผลักเข้าคิว (BR-01) */
  const confirmPayment = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.post('/orders', { items: cart.map((i) => ({ productId: i.productId, qty: i.qty })) });
      setResult(res); setStep('done');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (step === 'done' && result) {
    return (
      <Layout title="รับชำระเงินสำเร็จ">
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="alert ok"><b>บันทึกคำสั่งซื้อ {result.order.orderNo} เรียบร้อย</b> — ส่งเข้าคิวคลังสินค้าแล้ว</div>
          {!result.print.ok && (
            <div className="alert warn" style={{ marginTop: 10 }}>
              พิมพ์ใบเสร็จไม่สำเร็จ: {result.print.error} — คำสั่งซื้อถูกบันทึกและเข้าคิวแล้ว แจ้งผู้จัดการเพื่อสั่งพิมพ์ใหม่
            </div>
          )}
          <table style={{ marginTop: 12 }}>
            <tbody>
              {result.order.items.map((i) => (
                <tr key={i.productId}><td>{i.name}</td><td className="num">{int(i.qty)} {i.unit}</td><td className="num">{baht(i.lineTotal)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="total"><span>ยอดรวมทั้งสิ้น</span><b>{baht(result.order.totalAmount)} ฿</b></div>
          <button className="btn big green" style={{ marginTop: 16 }} onClick={reset}>รับคำสั่งซื้อถัดไป</button>
        </div>
      </Layout>
    );
  }

  if (step === 'payment' && quote) {
    return (
      <Layout title="รับชำระเงินด้วย QR พร้อมเพย์">
        <div className="split">
          <div className="card">
            <h2>รายการสินค้า</h2>
            <table>
              <thead><tr><th>สินค้า</th><th className="num">จำนวน</th><th className="num">ราคา/หน่วย</th><th className="num">รวม</th></tr></thead>
              <tbody>
                {quote.items.map((i) => (
                  <tr key={i.productId}><td>{i.name}</td><td className="num">{int(i.qty)} {i.unit}</td><td className="num">{baht(i.unitPrice)}</td><td className="num">{baht(i.lineTotal)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="total"><span>ยอดรวมทั้งสิ้น</span><b>{baht(quote.totalAmount)} ฿</b></div>
          </div>
          <div className="card qr-card">
            <h2>สแกนเพื่อชำระเงิน</h2>
            <div className="qrbox">
              {qrImage ? <img src={qrImage} alt="รหัส QR พร้อมเพย์" /> : <div className="muted">กำลังสร้างรหัส QR…</div>}
              <div className="qr-amount">{baht(quote.totalAmount)} ฿</div>
            </div>
            {error && <div className="alert crit">{error}</div>}
            <button className="btn big green" onClick={confirmPayment} disabled={busy}>{busy ? 'กำลังบันทึก…' : 'ยืนยันรับชำระเงิน'}</button>
            <div className="muted center-text">ตรวจการแจ้งเตือนเงินเข้าจากแอปธนาคารก่อนกดยืนยัน</div>
            <button className="btn ghost" style={{ width: '100%' }} onClick={() => setStep('cart')}>ย้อนกลับไปแก้รายการ</button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="ขายหน้าร้าน">
      <div className="split pos">
        <div className="card">
          <div className="chips">
            <button className={`chip ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>ทั้งหมด</button>
            {categories.map((c) => <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(category === c ? '' : c)}>{c}</button>)}
          </div>
          <input ref={searchBox} className="search" placeholder={category ? `ค้นในหมวด ${category}` : 'ค้นหาสินค้า — พิมพ์ชื่อหรือรหัส'} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <table className="picker">
            <tbody>
              {results.map((p) => (
                <tr key={p.product_id} onClick={() => add(p)}>
                  <td><small className="muted">{p.sku}</small><br />{p.name}</td>
                  <td className="num">{baht(p.price)}<br /><small className="muted">/ {p.unit}</small></td>
                  <td className="num"><small className={p.stock_qty > 0 ? 'muted' : 'crit'}>คงเหลือ {int(p.stock_qty)}</small></td>
                </tr>
              ))}
              {results.length === 0 && <tr><td className="muted">ไม่พบสินค้า{category ? `ในหมวด ${category}` : ''}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>รายการที่เลือก</h2>
          {cart.length === 0 ? <div className="muted">แตะสินค้าทางซ้ายเพื่อเพิ่ม</div> : (
            <table>
              <thead><tr><th>สินค้า</th><th className="num">จำนวน</th><th className="num">รวม</th></tr></thead>
              <tbody>
                {cart.map((i) => {
                  const line = quote?.items.find((x) => x.productId === i.productId);
                  return (
                    <tr key={i.productId}>
                      <td>{i.name}<br /><small className="muted">{baht(i.price)} / {i.unit}</small></td>
                      <td className="num qty">
                        <button className="btn small ghost" onClick={() => setQty(i.productId, i.qty - 1)}>−</button>
                        <input type="number" min="1" value={i.qty} onChange={(e) => setQty(i.productId, Number(e.target.value) || 0)} />
                        <button className="btn small ghost" onClick={() => setQty(i.productId, i.qty + 1)}>+</button>
                      </td>
                      <td className="num">{line ? baht(line.lineTotal) : '…'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {error && <div className="alert crit">{error}</div>}
          <div className="total"><span>ยอดรวมทั้งสิ้น</span><b>{quote ? baht(quote.totalAmount) : '0.00'} ฿</b></div>
          <button className="btn big" disabled={!quote || cart.length === 0} onClick={() => setStep('payment')}>แสดงรหัส QR เพื่อรับชำระ</button>
        </div>
      </div>
    </Layout>
  );
}
