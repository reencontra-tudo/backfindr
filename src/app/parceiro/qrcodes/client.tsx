'use client';

import { useState } from 'react';
import { QrCode, Plus, Download, Copy, CheckCircle2 } from 'lucide-react';

const MOCK_QR = [
  { id: '1', name: 'Recepção Principal', code: 'BF-RC001', scans: 47, active: true,  created: '01/04/2026' },
  { id: '2', name: 'Portaria 1',         code: 'BF-PT001', scans: 31, active: true,  created: '01/04/2026' },
  { id: '3', name: 'Portaria 2',         code: 'BF-PT002', scans: 28, active: true,  created: '01/04/2026' },
  { id: '4', name: 'Academia',           code: 'BF-AC001', scans: 19, active: true,  created: '05/04/2026' },
  { id: '5', name: 'Salão de Festas',    code: 'BF-SF001', scans: 14, active: true,  created: '05/04/2026' },
  { id: '6', name: 'Piscina',            code: 'BF-PI001', scans: 11, active: true,  created: '10/04/2026' },
  { id: '7', name: 'Salão de Jogos',     code: 'BF-SJ001', scans:  3, active: false, created: '15/04/2026' },
];

export default function ParceiroQRCodesClient() {
  const [copied, setCopied] = useState<string | null>(null);
  function copyCode(code: string) {
    navigator.clipboard.writeText(`https://backfindr.com/scan/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }
  const total = MOCK_QR.reduce((acc, q) => acc + q.scans, 0);
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">QR Codes</h1>
          <p className="text-white/30​​​​​​​​​​​​​​​​
'use client';

import { useState } from 'react';
import { QrCode, Plus, Download, Copy, CheckCircle2 } from 'lucide-react';

const MOCK_QR = [
  { id: '1', name: 'Recepção Principal', code: 'BF-RC001', scans: 47, active: true,  created: '01/04/2026' },
  { id: '2', name: 'Portaria 1',         code: 'BF-PT001', scans: 31, active: true,  created: '01/04/2026' },
  { id: '3', name: 'Portaria 2',         code: 'BF-PT002', scans: 28, active: true,  created: '01/04/2026' },
  { id: '4', name: 'Academia',           code: 'BF-AC001', scans: 19, active: true,  created: '05/04/2026' },
  { id: '5', name: 'Salão de Festas',    code: 'BF-SF001', scans: 14, active: true,  created: '05/04/2026' },
  { id: '6', name: 'Piscina',            code: 'BF-PI001', scans: 11, active: true,  created: '10/04/2026' },
  { id: '7', name: 'Salão de Jogos',     code: 'BF-SJ001', scans:  3, active: false, created: '15/04/2026' },
];

export default function ParceiroQRCodesClient() {
  const [copied, setCopied] = useState<string | null>(null);
  function copyCode(code: string) {
    navigator.clipboard.writeText(`https://backfindr.com/scan/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }
  const total = MOCK_QR.reduce((acc, q) => acc + q.scans, 0);
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">QR Codes</h1>
          <p className="text-white/30​​​​​​​​​​​​​​​​
