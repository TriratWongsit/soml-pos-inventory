// หน้าจอขายหน้าร้านและรับชำระด้วย QR พร้อมเพย์
//                                    [FR-03 · UC-03, UC-04 · รูปที่ 3.14, 3.15]
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import Layout from '../components/Layout.jsx';
import { api, baht, int } from '../api.js';

export default function Pos() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);            // [{ productId, qty }]
  const [quote, setQuote] = useState(null);
  const [step, setStep] = useState('cart');        // cart | payment
  const [qrImage, setQrImage] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/products').then((r) => setProducts(r.products)).catch((e) => setError(e.message));
  }, []);

  // ขอยอดรวมและรหัส QR ใหม่ทุกครั้งที่รายการในตะกร้าเปลี่ยน
  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null);
      return;
    }
    api.post('/orders/quote', { items: cart }).then(setQuote).catch((e) => setError(e.message));
  }, [cart]);

  useEffect(() => {
    if (step === 'payment' && quote?.qrPayload) {
      QRCode.toDataURL(quote.qrPayload, { margin: 0, width: 440, errorCorrectionLevel: 'M' })
        .then(setQrImage)
        .catch(() => setQrImage(null));
    }
  }, [step, quote]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => p.is_active && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  }, [products, search]);

  const addToCart = (product) => {
    setError(null);
    setCart((prev) => {
      const found = prev.find((i) => i.productId === product.product_id);
      return found
        ? prev.map((i) => (i.productId === product.product_id ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { productId: product.product_id, qty: 1 }];
    });
  };

  const setQty = (productId, qty) =>
    setCart((prev) => (qty <= 0 ? prev.filter((i) => i.productId !== productId) : prev.map((i) => (i.productId === productId ? { ...i, qty } : i))));

  const reset = () => {
    setCart([]); setQuote(null); setStep('cart'); setQrImage(null); setResult(null); setError(null);
  };

  /** ยืนยันรับชำระเงิน — จุดที่คำสั่งซื้อถูกบันทึกลงฐานข้อมูลครั้งเดียว */
  const confirmPayment = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/orders', { items: cart });
      setResult(res);
      setStep('done');
      api.get('/products').then((r) => setProducts(r.products));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done' && result) {
    return (
      <Layout title="รับชำระเงินสำเร็จ">
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="alert ok">
            <span className="t">บันทึกคำสั่งซื้อ {result.order.orderNo} เรียบร้อย</span>
          </div>
          {!result.print.ok && (
            <div className="alert warn">
              <span>พิมพ์ใบเสร็จไม่สำเร็จ — {result.print.error} · คำสั่งซื้อถูกบันทึกและส่งเข้าคิวคลังสินค้าแล้ว สั่งพิมพ์ซ้ำได้จากประวัติการทำรายการ</span>
            </div>
          )}
          <table>
            <tbody>
              {result.order.items.map((i) => (
                <tr key={i.productId}>
                  <td>{i.name}</td>
                  <td className="num">{int(i.qty)} {i.unit}</td>
                  <td className="num">{baht(i.lineTotal)}</td>
                </tr>
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
              <thead>
                <tr><th>สินค้า</th><th className="num">จำนวน</th><th className="num">ราคา/หน่วย</th><th className="num">รวม</th></tr>
              </thead>
              <tbody>
                {quote.items.map((i) => (
                  <tr key={i.productId}>
                    <td>{i.name}</td>
                    <td className="num">{int(i.qty)} {i.unit}</td>
                    <td className="num">{baht(i.unitPrice)}</td>
                    <td className="num">{baht(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="total"><span>ยอดรวมทั้งสิ้น</span><b>{baht(quote.totalAmount)} ฿</b></div>
          </div>

          <div className="card">
            <h2>สแกนเพื่อชำระเงิน</h2>
            <div className="qrbox">
              {qrImage ? <img src={qrImage} alt="รหัส QR พร้อมเพย์" /> : <div className="muted">กำลังสร้างรหัส QR…</div>}
              <div style={{ fontSize: 27, fontWeight: 700, color: '#16283d', marginTop: 10 }}>{baht(quote.totalAmount)} ฿</div>
            </div>
            {error && <div className="alert crit"><span>{error}</span></div>}
            <button className="btn big green" onClick={confirmPayment} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'ยืนยันรับชำระเงิน'}
            </button>
            <div className="muted" style={{ marginTop: 8, textAlign: 'center' }}>
              ตรวจสอบการแจ้งเตือนเงินเข้าจากแอปพลิเคชันธนาคารก่อนกดยืนยัน
            </div>
            <button className="btn ghost" style={{ marginTop: 12, width: '100%' }} onClick={() => setStep('cart')}>
              ย้อนกลับไปแก้รายการ
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="ขายหน้าร้าน">
      <div className="split">
        <div className="card">
          <h2>เลือกสินค้า</h2>
          <input className="search" type="text" placeholder="ค้นหาด้วยชื่อสินค้าหรือรหัสสินค้า"
                 value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="plist" style={{ marginTop: 10, maxHeight: 460, overflowY: 'auto' }}>
            {visible.map((p) => (
              <div key={p.product_id} className={`row${p.stock_qty <= 0 ? ' out' : ''}`}
                   onClick={() => p.stock_qty > 0 && addToCart(p)}>
                <span>{p.name} <span className="muted">· {p.sku}</span></span>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                  คงเหลือ {int(p.stock_qty)} {p.unit} · {baht(p.price)} ฿
                </span>
              </div>
            ))}
            {visible.length === 0 && <div className="muted" style={{ padding: 10 }}>ไม่พบสินค้าที่ค้นหา</div>}
          </div>
        </div>

        <div className="card">
          <h2>คำสั่งซื้อปัจจุบัน</h2>
          {error && <div className="alert crit"><span>{error}</span></div>}
          {cart.length === 0 ? (
            <div className="muted">ยังไม่ได้เลือกสินค้า — คลิกที่รายการสินค้าทางซ้ายเพื่อเพิ่มลงคำสั่งซื้อ</div>
          ) : (
            <>
              <table>
                <thead>
                  <tr><th>สินค้า</th><th className="num" style={{ width: 92 }}>จำนวน</th><th className="num">รวม</th><th /></tr>
                </thead>
                <tbody>
                  {(quote?.items || []).map((i) => (
                    <tr key={i.productId}>
                      <td>{i.name}<div className="muted">{baht(i.unitPrice)} ฿ / {i.unit}</div></td>
                      <td className="num">
                        <input type="number" min="1" value={i.qty} style={{ width: 78, textAlign: 'right' }}
                               onChange={(e) => setQty(i.productId, Number(e.target.value))} />
                      </td>
                      <td className="num">{baht(i.lineTotal)}</td>
                      <td className="num">
                        <button className="btn ghost small" onClick={() => setQty(i.productId, 0)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="total"><span>ยอดรวมทั้งสิ้น</span><b>{baht(quote?.totalAmount)} ฿</b></div>
              <button className="btn big" style={{ marginTop: 14 }} disabled={!quote} onClick={() => setStep('payment')}>
                สร้าง QR พร้อมเพย์
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
