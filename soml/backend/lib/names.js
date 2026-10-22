// ---------------------------------------------------------------------
// ชื่อย่อพนักงานสำหรับใบเสร็จ                                    [คอมเมนต์กรรมการ K-2 · PDPA 2.3.3]
//
// ใบเสร็จไปอยู่กับลูกค้า จึงพิมพ์ข้อมูลส่วนบุคคลของพนักงานเท่าที่จำเป็น
// ชื่อต้นเต็ม + อักษรตัวแรกของนามสกุล เช่น "ศริพรรณ ศิริกันทา" → "ศริพรรณ ศ."  ชื่อคำเดียวคงไว้ เช่น "นิ้ง"
// ---------------------------------------------------------------------
function shortName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const initial = [...parts[parts.length - 1]].find((ch) => /[ก-ฮA-Za-z]/.test(ch)) || parts[parts.length - 1][0];
  return `${first} ${initial}.`;
}

module.exports = { shortName };
