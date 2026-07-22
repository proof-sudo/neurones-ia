/** État d'erreur franc quand le backend est injoignable — pas de repli sur des
 * données fictives : l'utilisateur voit que quelque chose ne va pas, pas des
 * chiffres inventés. Même pattern que app/(cockpit)/admin/page.tsx. */
export function ErrorState({ title, error }: { title: string; error: string | null }) {
  return (
    <div className="rounded-card border border-l-[3px] border-line border-l-bad bg-panel p-5">
      <h3 className="mb-2 text-[14.5px] font-semibold">{title}</h3>
      <p className="text-[12.5px] leading-relaxed text-text">
        Impossible de charger les données depuis le backend{error ? ` (${error})` : ""}. Vérifiez
        que l&apos;API FastAPI est démarrée (port 8000) et que votre session n&apos;a pas expiré,
        puis rechargez la page.
      </p>
    </div>
  );
}
