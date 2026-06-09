import { BottomNav } from "./BottomNav.jsx";
import { TopNav } from "./TopNav.jsx";

export function DeviceShell({ children, activeNav, topActive, onScreen, t, lang, onLang }) {
  return (
    <div className="flex h-screen flex-col bg-white font-body text-ink antialiased">
      <TopNav
        className="hidden lg:flex"
        active={topActive}
        onScreen={onScreen}
        t={t}
        lang={lang}
        onLang={onLang}
      />
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      {activeNav ? <BottomNav className="lg:hidden" active={activeNav} onScreen={onScreen} t={t} /> : null}
    </div>
  );
}
