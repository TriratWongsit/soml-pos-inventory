# coding: utf-8
# อ่านความกว้างตัวอักษร (advance width) จากไฟล์ TTF โดยตรง ใช้ใน check-gaps.py เพื่อหาบรรทัดที่ตัวอักษรถูกยืด
# รองรับเฉพาะตาราง cmap รูปแบบ 4 ซึ่งฟอนต์ TH Sarabun New ใช้
import struct


class Widths:
    def __init__(self, path):
        d = open(path, 'rb').read()
        n = struct.unpack('>H', d[4:6])[0]
        tab = {}
        for i in range(n):
            tag, _, off, ln = struct.unpack('>4sIII', d[12 + 16 * i:28 + 16 * i])
            tab[tag.decode('latin1')] = (off, ln)
        self.upem = struct.unpack('>H', d[tab['head'][0] + 18:tab['head'][0] + 20])[0]
        nlong = struct.unpack('>H', d[tab['hhea'][0] + 34:tab['hhea'][0] + 36])[0]
        h = tab['hmtx'][0]
        self.adv = [struct.unpack('>H', d[h + 4 * i:h + 4 * i + 2])[0] for i in range(nlong)]
        c = tab['cmap'][0]
        sub = None
        for i in range(struct.unpack('>H', d[c + 2:c + 4])[0]):
            pid, eid, off = struct.unpack('>HHI', d[c + 4 + 8 * i:c + 12 + 8 * i])
            if struct.unpack('>H', d[c + off:c + off + 2])[0] == 4 and pid in (0, 3):
                sub = c + off
                break
        seg = struct.unpack('>H', d[sub + 6:sub + 8])[0] // 2
        p = sub + 14
        end = struct.unpack('>%dH' % seg, d[p:p + 2 * seg]); p += 2 * seg + 2
        start = struct.unpack('>%dH' % seg, d[p:p + 2 * seg]); p += 2 * seg
        delta = struct.unpack('>%dh' % seg, d[p:p + 2 * seg]); p += 2 * seg
        roff_at = p
        roff = struct.unpack('>%dH' % seg, d[p:p + 2 * seg])
        self.map = {}
        for i in range(seg):
            for ch in range(start[i], end[i] + 1):
                if ch == 0xFFFF:
                    continue
                if roff[i] == 0:
                    g = (ch + delta[i]) & 0xFFFF
                else:
                    a = roff_at + 2 * i + roff[i] + 2 * (ch - start[i])
                    g = struct.unpack('>H', d[a:a + 2])[0]
                    g = (g + delta[i]) & 0xFFFF if g else 0
                self.map[ch] = g

    def width(self, s, size):
        """ความกว้างของข้อความเป็นพอยต์ที่ขนาดตัวอักษร size"""
        tot = 0
        for ch in s:
            g = self.map.get(ord(ch), 0)
            tot += self.adv[min(g, len(self.adv) - 1)]
        return tot * size / self.upem
