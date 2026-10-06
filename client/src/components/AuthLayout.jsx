import { Wordmark } from './Brand';
import ModeToggle from './ModeToggle';
import { HeartPulse, ClipboardList, MonitorSmartphone, Printer } from 'lucide-react';

const FEATURES = [
  { icon: ClipboardList, title: 'Case file in under a minute', text: 'Tap-to-select complaints, vitals and history.' },
  { icon: MonitorSmartphone, title: 'Nurse → Doctor, instantly', text: 'Send a case to the doctor’s laptop or phone with one tap.' },
  { icon: Printer, title: 'Beautiful A4 case sheets', text: 'Print-ready summaries patients can also download.' },
];

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-100 via-brand-50 to-white p-12 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-brand-200/60 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 size-80 rounded-full bg-brand-300/30 blur-3xl" />
        <Wordmark />
        <div className="relative my-auto max-w-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-brand-700 shadow-soft">
            <HeartPulse size={14} /> Built for small & busy clinics
          </div>
          <h1 className="text-[42px] leading-[1.1] font-extrabold tracking-tight text-ink">
            Calm software for <span className="text-brand-600">busy clinics.</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600">One doctor, one nurse or a full team — CareNest keeps the queue moving with far fewer clicks.</p>
          <div className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, title: t, text }) => (
              <div key={t} className="flex gap-4 rounded-3xl bg-white/70 p-4 shadow-soft backdrop-blur">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-500 text-white"><Icon size={20} /></div>
                <div><div className="font-bold">{t}</div><div className="text-sm text-muted">{text}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-muted">© {new Date().getFullYear()} CareNest HIMS</div>
      </div>
      <div className="relative flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <ModeToggle className="absolute top-4 right-4" />
        <div className="mb-8 lg:hidden"><Wordmark /></div>
        <div className="animate-in w-full max-w-md">
          <h2 className="text-[28px] font-extrabold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
