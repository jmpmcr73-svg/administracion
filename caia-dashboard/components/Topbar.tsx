import { Logo } from "./Logo";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-5 py-3">
        <Logo />
        <div className="leading-tight">
          <div className="display text-[15px] font-700 tracking-[0.22em] text-white">
            CAIA <span className="text-cyan">·</span> CENTRO DE COMANDO
          </div>
          <div className="label">Cerebro unificado · caia-prod</div>
        </div>

        <div className="ml-auto flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-cyan shadow-glow" />
          <span className="font-mono text-[10px] font-700 uppercase tracking-[0.2em] text-cyan">
            En vivo
          </span>
        </div>
      </div>
    </header>
  );
}
