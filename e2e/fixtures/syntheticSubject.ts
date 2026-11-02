import { randomInt } from 'crypto';

export function syntheticName(): string {
  return Array.from({ length: 3 }, () => String.fromCharCode(65 + randomInt(26))).join('');
}

export function subjectNumber(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `Auto-${pad(date.getDate())}${pad(date.getMonth() + 1)}${String(date.getFullYear()).slice(-2)}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
