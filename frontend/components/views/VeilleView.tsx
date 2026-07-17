import { AiChip } from "@/components/ui/AiChip";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHead } from "@/components/ui/Panel";
import {
  DISCARDED_SIGNALS,
  VEILLE_RECOS,
  VEILLE_SOURCES,
} from "@/lib/fixtures/veille";

export function VeilleView() {
  return (
    <>
      <div className="mb-4 flex justify-end">
        <AiChip>5 sources actives</AiChip>
      </div>

      {/* constat de données */}
      <div className="mb-4 rounded-card border border-l-[3px] border-line border-l-warn bg-panel p-5">
        <PanelHead title="Constat de données" />
        <p className="text-[12.5px] leading-relaxed text-text">
          Il n&apos;existe aucune table de suivi concurrentiel dans <code>neurones.db</code> —
          les « concurrents » affichés précédemment étaient fictifs et ont été retirés. En
          revanche, la table <code>veille_sources</code> contient 5 vraies sources de veille
          marchés publics, actives et déjà interrogées. La table <code>veille_entries</code>{" "}
          (65 lignes) contient des signaux réels côté axe <b>« clients »</b>{" "}
          (appels d&apos;offres publics UEMOA), déjà analysés par l&apos;IA — voir le module{" "}
          <b>Veille AO</b>. L&apos;axe <b>« réglementaire »</b>{" "}
          est en revanche essentiellement du bruit de scraping plutôt que de vrais signaux
          exploitables.
        </p>
      </div>

      {/* sources actives */}
      <Panel className="mb-4">
        <PanelHead title="Sources de veille actives" />
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Source", "Zone couverte", "Mots-clés surveillés", "Dernier scan"].map((h) => (
                <th
                  key={h}
                  className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VEILLE_SOURCES.map((s) => (
              <tr key={s.name} className="border-b border-line last:border-none">
                <td className="px-2 py-2.5 text-text">
                  {s.name}
                  <div className="text-[10.5px] text-muted">{s.url}</div>
                </td>
                <td className="px-2 py-2.5">{s.zone}</td>
                <td className="px-2 py-2.5">{s.keywords}</td>
                <td className="px-2 py-2.5">
                  <Badge variant="open">{s.lastScan}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* signaux écartés */}
      <Panel className="mb-4">
        <PanelHead title="Signaux écartés par l'IA (filtrage réel)">
          <AiChip>preuve du filtrage — pas des concurrents, un vrai contrôle qualité IA</AiChip>
        </PanelHead>
        <p className="mb-3.5 text-[11.5px] leading-relaxed text-muted">
          Aucune donnée concurrentielle réelle n&apos;existe dans vos données. Voici de vrais
          signaux que l&apos;IA a correctement écartés comme hors périmètre — la preuve que le
          filtrage fonctionne plutôt que de faire remonter du bruit.
        </p>
        {DISCARDED_SIGNALS.map((s, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 border-b border-line py-2.5 last:border-none"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-good" />
            <div>
              <div className="text-[12.5px] leading-snug">
                <b>{s.titre}</b>
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] text-muted">
                Écarté par l&apos;IA · {s.motif}
              </div>
            </div>
          </div>
        ))}
      </Panel>

      {/* recommandations IA */}
      <div className="rounded-card border border-l-[3px] border-line border-l-ai bg-panel p-5">
        <PanelHead title="Comment activer une vraie veille concurrentielle">
          <AiChip>recommandé par l&apos;IA</AiChip>
        </PanelHead>
        <div className="flex flex-col gap-2.5">
          {VEILLE_RECOS.map((r, i) => (
            <div
              key={i}
              className="rounded-lg border border-l-2 border-line border-l-ai bg-panel-2 px-3.5 py-3"
            >
              <div className="text-[13px] font-semibold">{r.titre}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-muted">{r.texte}</div>
              <div className="mt-1.5 font-mono text-[10.5px] text-muted">
                Effort estimé : {r.effort}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
