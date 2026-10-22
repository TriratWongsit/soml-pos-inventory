// หน้าขายหน้าร้าน                                  [ตารางที่ 3.18 หน้าจอ 2 · ตารางที่ 3.24 · UC-03 · รูปที่ 3.8]
//
// งานเดียว: เลือกสินค้า → ยอดรวม → QR → ยืนยันรับชำระ (3.4.3.1 ข้อแรก)
// สามขั้นบนหน้าจอเดียว: cart → payment → done
//   cart     ค้นหา/เพิ่มสินค้า แก้จำนวน เห็นยอดรวม (ยอดคำนวณจากหลังบ้านเสมอ ผ่าน /orders/quote)
//   payment  แสดง QR ตามยอด · ปุ่ม "ยืนยันรับชำระเงิน" = จุดเดียวที่คำสั่งซื้อถูกบันทึก (BR-01)
//   done     เลขที่คำสั่งซื้อ + ผลการพิมพ์ (พิมพ์ล้มไม่ทำให้การขายล้ม — UC-03 ทางที่ล้มเหลว)
// หลังสอบ: เลือกวิธีชำระ QR หรือขายเชื่อ (K-6) · หน้า QR แสดงปลายทางและต้องติ๊กยืนยันเงินเข้า (K-3)
//          ยอดคงเหลือในรายการสินค้าโหลดใหม่เองเมื่อคลังจ่ายของ (K-1)
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Layout from '../../components/Layout.jsx';
import { baht, int } from '../../components/Money.jsx';
import { api } from '../../services/api.js';
import { subscribe } from '../../services/events.js';

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
  const [payMethod, setPayMethod] = useState('promptpay');  // 'promptpay' | 'cash' | 'credit'
  const [cashIn, setCashIn] = useState('');                  // เงินสดที่รับมา (เพิ่มหลังสอบ)
  const [customer, setCustomer] = useState(null);            // ลูกค้าขายเชื่อที่เลือก
  const [custQ, setCustQ] = useState('');
  const [custList, setCustList] = useState([]);
  const [newCust, setNewCust] = useState(null);              // { name, phone } ตอนเพิ่มลูกค้าใหม่
  const [arming, setArming] = useState(false);               // ขายเชื่อ: กดครั้งแรกแล้ว รอยืนยัน
  const [moneyIn, setMoneyIn] = useState(false);             // QR: ติ๊กว่าเห็นเงินเข้าแล้ว
  const [refresh, setRefresh] = useState(0);
  const searchBox = useRef(null);

  // คลังจ่ายของหรือผู้จัดการปรับสต็อก → ค้นใหม่ ยอด "คงเหลือ" จะตรงเสมอ
  useEffect(() => subscribe((ev) => { if (ev === 'order.dispatched' || ev === 'product.stock') setRefresh((n) => n + 1); }), []);

  useEffect(() => {
    if (payMethod !== 'credit') return undefined;
    const t = setTimeout(() => api.get(`/customers?q=${encodeURIComponent(custQ)}`).then((r) => setCustList(r.customers)).catch((e) => setError(e.message)), 200);
    return () => clearTimeout(t);
  }, [payMethod, custQ]);

  // ค้นหาสินค้า — เลือกหมวดก่อนแล้วค่อยพิมพ์ค้น (ตาราง 3.24) · รอพิมพ์เสร็จ 200 ms ค่อยถาม
  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`)
        .then((r) => { setResults(r.products.slice(0, 40)); setCategories(r.categories); })
        .catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [q, category, refresh]);

  // ทุกครั้งที่ตะกร้าเปลี่ยน ให้หลังบ้านคิดยอดใหม่ — ราคาบนหน้าจอเป็นแค่ตัวช่วยดู ราคาจริงอยู่ที่ฐาน
  useEffect(() => {
    if (cart.length === 0) { setQuote(null); return; }
    api.post('/orders/quote', { items: cart.map((i) => ({ productId: i.productId, qty: i.qty })) })  // ◀ [D-2] เดโม: หน้าจอขอให้หลังบ้านคิดยอด
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
  const reset = () => {
    setCart([]); setQuote(null); setStep('cart'); setQrImage(null); setResult(null); setError(null);
    setPayMethod('promptpay'); setCustomer(null); setCustQ(''); setNewCust(null); setArming(false); setMoneyIn(false); setCashIn('');
  };

  const addCustomer = async () => {
    try {
      const r = await api.post('/customers', newCust);
      setCustomer(r.customer); setNewCust(null); setError(null);
    } catch (e) { setError(e.message); }
  };

  /** ยืนยันรับชำระเงิน — จุดเดียวที่คำสั่งซื้อถูกบันทึก พิมพ์ใบเสร็จ และผลักเข้าคิว (BR-01) */
  const confirmPayment = async () => {  // ◀ [D-2] เดโม: กดยืนยันรับชำระ
    setBusy(true); setError(null);
    try {
      const res = await api.post('/orders', {
        items: cart.map((i) => ({ productId: i.productId, qty: i.qty })),
        paymentMethod: payMethod,
        customerId: payMethod === 'credit' ? customer?.customer_id : undefined,
        cashReceived: payMethod === 'cash' ? Number(cashIn) : undefined,
        quotedTotal: quote?.totalAmount,   // K-3 ยอดที่ลูกค้าเห็น ถ้าราคาเปลี่ยนระหว่างนั้น หลังบ้านปฏิเสธ
      });
      setResult(res); setStep('done');
    } catch (e) {
      setError(e.message); setArming(false);
      if (e.code === 'TOTAL_CHANGED') { setStep('cart'); setMoneyIn(false); setCart((c) => [...c]); }  // คิดยอดใหม่ แล้วให้แสดง QR ใหม่
    } finally { setBusy(false); }
  };

  if (step === 'done' && result) {
    return (
      <Layout title={result.order.paymentMethod === 'credit' ? 'บันทึกขายเชื่อสำเร็จ' : 'รับชำระเงินสำเร็จ'}>
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="alert ok"><b>บันทึกคำสั่งซื้อ {result.order.orderNo} เรียบร้อย</b> — ส่งเข้าคิวคลังสินค้าแล้ว</div>
          {result.order.paymentMethod === 'cash' && (
            <div className="change-box">รับเงินสด {baht(result.order.cashReceived)} บาท · <b>ทอน {baht(result.order.change)} บาท</b></div>
          )}
          {result.order.paymentMethod === 'credit' && (
            <div className="alert warn" style={{ marginTop: 10 }}>
              ขายเชื่อให้ <b>{result.order.customer?.name}</b> — พิมพ์ 2 ใบ ลูกค้าเก็บ 1 ใบ ร้านเก็บ 1 ใบที่ลูกค้าเซ็นรับของ
            </div>
          )}
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
              {quote.promptpayTo && <div className="muted center-text">โอนเข้าพร้อมเพย์ของร้าน {quote.promptpayTo} — ให้ลูกค้าดูชื่อบัญชีในแอปก่อนกดโอน</div>}
            </div>
            {error && <div className="alert crit">{error}</div>}
            <label className="check">
              <input type="checkbox" checked={moneyIn} onChange={(e) => setMoneyIn(e.target.checked)} />
              ตรวจแอปธนาคารแล้ว เงินเข้าบัญชีร้านครบ {baht(quote.totalAmount)} บาท
            </label>
            <button className="btn big green" onClick={confirmPayment} disabled={busy || !moneyIn}>{busy ? 'กำลังบันทึก…' : 'ยืนยันรับชำระเงิน'}</button>
            <button className="btn ghost" style={{ width: '100%' }} onClick={() => { setStep('cart'); setMoneyIn(false); }}>ย้อนกลับไปแก้รายการ</button>
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

          <div className="seg" role="radiogroup" aria-label="วิธีชำระ">
            <button className={payMethod === 'promptpay' ? 'on' : ''} onClick={() => { setPayMethod('promptpay'); setArming(false); }}>จ่ายด้วย QR พร้อมเพย์</button>
            <button className={payMethod === 'cash' ? 'on' : ''} onClick={() => { setPayMethod('cash'); setArming(false); }}>เงินสด</button>
            <button className={payMethod === 'credit' ? 'on' : ''} onClick={() => setPayMethod('credit')}>ขายเชื่อ (บิลเซ็น)</button>
          </div>

          {payMethod === 'promptpay' ? (
            <button className="btn big" disabled={!quote || cart.length === 0} onClick={() => { setMoneyIn(false); setStep('payment'); }}>แสดงรหัส QR เพื่อรับชำระ</button>
          ) : payMethod === 'cash' ? (
            <div className="credit-box">
              <label htmlFor="cash-in"><b>รับเงินมา (บาท)</b></label>
              <input id="cash-in" className="search" type="number" min="0" step="1" inputMode="decimal" value={cashIn} onChange={(e) => setCashIn(e.target.value)} placeholder="เช่น 1000" />
              <div className="quick-cash">
                {quote && [quote.totalAmount, ...[100, 500, 1000].map((b) => Math.ceil(quote.totalAmount / b) * b)]
                  .filter((v, i, a) => a.indexOf(v) === i).slice(0, 4)
                  .map((v) => <button key={v} className="btn small ghost" onClick={() => setCashIn(String(v))}>{baht(v)}</button>)}
              </div>
              {quote && cashIn !== '' && (Number(cashIn) >= quote.totalAmount
                ? <div className="change-box">เงินทอน <b>{baht(Number(cashIn) - quote.totalAmount)} บาท</b></div>
                : <div className="alert crit">รับเงินไม่พอ ขาดอีก {baht(quote.totalAmount - Number(cashIn))} บาท</div>)}
              <button className="btn big green" disabled={!quote || cart.length === 0 || busy || !(Number(cashIn) >= (quote?.totalAmount ?? Infinity))} onClick={confirmPayment}>
                {busy ? 'กำลังบันทึก…' : 'ยืนยันรับเงินสด'}
              </button>
            </div>
          ) : (
            <div className="credit-box">
              {customer ? (
                <div className="picked">ลูกค้า: <b>{customer.name}</b>{customer.phone ? ` · ${customer.phone}` : ''}
                  {customer.outstanding > 0 && <small className="crit"> · ค้างอยู่ {baht(customer.outstanding)} ฿</small>}
                  <button className="btn small ghost" onClick={() => { setCustomer(null); setArming(false); }}>เปลี่ยน</button></div>
              ) : newCust ? (
                <div className="new-cust">
                  <input placeholder="ชื่อลูกค้า / ร้าน / ผู้รับเหมา" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} autoFocus />
                  <input placeholder="เบอร์โทร" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
                  <button className="btn small" onClick={addCustomer} disabled={!newCust.name.trim()}>บันทึกลูกค้า</button>
                  <button className="btn small ghost" onClick={() => setNewCust(null)}>ยกเลิก</button>
                </div>
              ) : (
                <>
                  <input className="search" placeholder="ค้นหาลูกค้าขายเชื่อ — ชื่อหรือเบอร์โทร" value={custQ} onChange={(e) => setCustQ(e.target.value)} />
                  <div className="cust-list">
                    {custList.map((c) => (
                      <button key={c.customer_id} className="cust" onClick={() => setCustomer(c)} disabled={!c.is_active}>
                        <span>{c.name}{c.phone ? ` · ${c.phone}` : ''}</span>
                        {c.outstanding > 0 && <small className="crit">ค้าง {baht(c.outstanding)}</small>}
                      </button>
                    ))}
                    {custList.length === 0 && <div className="muted">ไม่พบลูกค้า</div>}
                  </div>
                  <button className="btn small ghost" onClick={() => setNewCust({ name: custQ, phone: '' })}>+ เพิ่มลูกค้าใหม่</button>
                </>
              )}
              {!arming ? (
                <button className="btn big" disabled={!quote || cart.length === 0 || !customer} onClick={() => setArming(true)}>ขายเชื่อให้ลูกค้าคนนี้</button>
              ) : (
                <div className="confirm-box">
                  <div><b>ยืนยันขายเชื่อ</b> {baht(quote.totalAmount)} บาท ให้ {customer.name} — พิมพ์ 2 ใบ ให้ลูกค้าเซ็นใบที่ร้านเก็บ</div>
                  <button className="btn big green" onClick={confirmPayment} disabled={busy}>{busy ? 'กำลังบันทึก…' : 'ยืนยันขายเชื่อ'}</button>
                  <button className="btn ghost" style={{ width: '100%' }} onClick={() => setArming(false)} disabled={busy}>ยังก่อน</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
