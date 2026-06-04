import { BottomNav } from "./BottomNav.jsx";

export function DeviceShell({ children, activeNav, onScreen, t }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(90deg,rgba(239,49,36,0.08)_1px,transparent_1px),linear-gradient(180deg,#fbfbfb_0%,#ececec_100%)] bg-[length:32px_32px,auto] p-0 font-body text-ink antialiased sm:grid sm:place-items-center sm:p-5">
      <section
        aria-label="Washgo clickable mobile prototype"
        className="grid h-screen w-full grid-rows-[1fr_auto] overflow-hidden bg-white shadow-device sm:h-[900px] sm:max-h-[calc(100vh-40px)] sm:w-[402px] sm:border sm:border-black/20"
      >
        <main className="min-h-0">{children}</main>
        {activeNav ? <BottomNav active={activeNav} onScreen={onScreen} t={t} /> : null}
      </section>
    </div>
  );
}
