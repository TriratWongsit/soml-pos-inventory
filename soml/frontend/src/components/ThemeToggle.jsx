// ปุ่มสลับโหมดสว่าง / มืด — มีที่หัวทุกหน้าจอและหน้าเข้าสู่ระบบ   [3.9.1]
import Icon from './Icon.jsx';
import { useTheme } from '../services/theme.js';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const toLight = theme === 'dark';
  return (
    <button type="button" className="btn ghost theme-toggle" onClick={toggle} aria-label="สลับโหมดสว่างและมืด">
      <Icon name={toLight ? 'sun' : 'moon'} size={18} />
      <span>{toLight ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
    </button>
  );
}
