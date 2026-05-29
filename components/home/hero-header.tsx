import { LogoutButton } from "@/components/logout-button";

/** Cabecera de marca: pelota + "PRODE DE LOS PIBES" + corona + subtítulo. */
export function HeroHeader() {
  return (
    <header className="flex animate-fade-up flex-col gap-2">
      <div className="flex justify-end">
        <LogoutButton />
      </div>
      <div className="-mt-1 flex flex-col items-center text-center">
        <div className="flex items-end justify-center gap-2">
          <span aria-hidden className="mb-1 text-4xl leading-none">
            ⚽
          </span>
          <div className="text-display leading-[0.82]">
            <span className="block text-[2.6rem] text-cream text-shadow-pop">
              PRODE
            </span>
            <span className="block text-[2.6rem] text-gold drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]">
              DE LOS PIBES
            </span>
          </div>
          <span aria-hidden className="mb-7 text-2xl leading-none">
            👑
          </span>
        </div>
        <p className="mt-3 text-sm font-medium text-cream/80">
          Predicciones, cargadas y gloria eterna.
        </p>
      </div>
    </header>
  );
}
