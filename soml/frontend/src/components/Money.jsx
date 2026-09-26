// ตัวเลขที่ใช้ตัดสินใจต้องอ่านง่าย (3.9.1 ข้อสอง) — รูปแบบเงินและจำนวนใช้ที่เดียวทั้งระบบ
export const baht = (n) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const int = (n) => Number(n).toLocaleString('th-TH');
export default function Money({ value, unit = '฿' }) {
  return <span className="money">{baht(value)} <small>{unit}</small></span>;
}
