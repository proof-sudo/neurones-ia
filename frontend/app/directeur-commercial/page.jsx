"use client";
import React, { useState, useRef } from 'react';
import {
  TrendingUp, Sparkles, ArrowRight, Check, X, Info, Users,
  Search, Mic, Wallet, Radar,
  UserCheck, RefreshCw, ChevronRight, Building2, Clock, Shield, Send,
  ListChecks, Gauge, Bell, CheckCircle2, PhoneCall, Newspaper, Layers,
  Lightbulb, ArrowUpRight, Compass,
} from 'lucide-react';

/* ----------------------------------------------------------------------
   DONNÉES — cohérentes avec le catalogue des 20 fonctions IA « Directeur
   Commercial » et l'univers Neurones Technologies (Abidjan, Odoo 18).
   ---------------------------------------------------------------------- */

const fmt = (n) => Math.round(n).toLocaleString('fr-FR') + ' M';

const OPPORTUNITES = [
  { id: 'o1', client: 'Trésor Public CI', montant: 2100, prob: 0.60, probIA: 0.52, jours: 4, commercial: 'Awa D.' },
  { id: 'o2', client: 'SGBCI', montant: 480, prob: 0.75, probIA: 0.74, jours: 38, commercial: 'Awa D.' },
  { id: 'o3', client: 'MTN CI', montant: 320, prob: 0.40, probIA: 0.22, jours: 52, commercial: 'Koffi B.' },
  { id: 'o4', client: 'BCEAO', montant: 610, prob: 0.55, probIA: 0.58, jours: 12, commercial: 'Koffi B.' },
  { id: 'o5', client: 'BAD — UEMOA', montant: 900, prob: 0.30, probIA: 0.31, jours: 45, commercial: 'Mariam S.' },
  { id: 'o6', client: 'Orange CI (riposte)', montant: 250, prob: 0.20, probIA: 0.09, jours: 61, commercial: 'Mariam S.' },
];
const OBJECTIF = 2900, SECURISE = 280;
const PONDERE_IA = OPPORTUNITES.reduce((s, o) => s + o.montant * o.probIA, 0);
const ECART = Math.round(SECURISE + PONDERE_IA - OBJECTIF);

const CHIP_GROUPS = [
  { key: 'piloter', title: 'Piloter le trimestre', accent: '#F0A93B', items: [
    { n: 2, name: 'Atterrissage du trimestre' }, { n: 1, name: 'Scoring des opportunités' },
    { n: 15, name: 'Simulation de clôture' }, { n: 13, name: 'Priorisation du portefeuille' },
  ]},
  { key: 'agir', title: 'Agir, dossier par dossier', accent: '#2563EB', items: [
    { n: 3, name: 'Prochaine meilleure action' }, { n: 4, name: 'Pipeline fictif' },
    { n: 19, name: 'Relances contextualisées' }, { n: 14, name: 'Compte-rendu vocal' },
  ]},
  { key: 'anticiper', title: 'Anticiper les risques', accent: '#7C3AED', items: [
    { n: 9, name: 'Risque d’attrition' }, { n: 18, name: 'Alertes concurrence' },
    { n: 17, name: 'Cartographie décideurs' }, { n: 5, name: 'Radar bench → pipeline' },
  ]},
  { key: 'developper', title: 'Vendre plus, sur l’existant', accent: '#0E7C86', items: [
    { n: 10, name: 'Cross-sell / up-sell' }, { n: 11, name: 'Pricing intelligent' },
    { n: 12, name: 'Go/No-Go sur AO' }, { n: 6, name: 'Veille AO automatisée' }, { n: 20, name: 'Charge avant-vente' },
  ]},
  { key: 'progresser', title: 'Faire progresser l’équipe', accent: '#5B6472', items: [
    { n: 7, name: 'Analyse win/loss' }, { n: 16, name: 'Coaching par l’IA' }, { n: 8, name: 'Brief de RDV auto' },
  ]},
];

/* -- 10 leviers proposés (§ « Le prochain palier ») — pas encore actifs,
   présentés avec leur pertinence (l'angle mort qu'ils couvrent) et leur
   valeur ajoutée estimée. N'affecte aucune des 20 fonctions actives.
   Classés en 3 temps : Veille (repérer un signal) → Analyse (le
   transformer en décision) → Action (produire l'appui concret). -- */
const LEVIER_GROUPS = [
  { key: 'veille', title: 'Veille', tagline: 'Repérer un signal avant tout le monde', accent: '#1E3A5F' },
  { key: 'analyse', title: 'Analyse', tagline: 'Transformer le signal en décision chiffrée', accent: '#6B3A72' },
  { key: 'action', title: 'Action', tagline: 'Produire l’appui concret pour agir', accent: '#BE3455' },
];
const LEVIERS = [
  // -- Veille : détecter le signal avant qu'il ne devienne un problème ou une occasion manquée --
  { n: 27, groupe: 'veille', name: 'Détection de moments chauds sur événements externes',
    aujourdhui: 'La veille AO (#6) couvre les marchés publics et les bailleurs ; les signaux propres à l’entreprise cliente (nouveau DSI, levée de fonds, incident) ne sont pas suivis.',
    levier: 'Détecte ces signaux en continu — notamment une nomination DSI/DG chez un compte suivi, qui ouvre une fenêtre d’environ 6 mois où l’audit de l’existant et le changement de prestataire sont probables. Capté via Sales Navigator ou un fournisseur de données conforme — jamais par extraction directe de LinkedIn, contraire à ses CGU.',
    valeur: 'Capte des fenêtres commerciales aujourd’hui invisibles, avant la concurrence.' },
  { n: 28, groupe: 'veille', name: 'Renégociation anticipée avant échéance (land & expand)',
    aujourdhui: 'Le renouvellement est généralement traité au moment de l’échéance, en position passive.',
    levier: 'Repère le bon moment pour revenir à la hausse selon l’usage réel et les signaux d’expansion du client.',
    valeur: 'Fait grandir des comptes comme SGBCI ou BCEAO avant même la fin de contrat.' },
  { n: 29, groupe: 'veille', name: 'Réactivation intelligente des dossiers perdus et clients dormants',
    aujourdhui: 'Le pipeline fictif (#4) nettoie les dossiers actifs qui dorment ; les dossiers fermés ne sont jamais revisités.',
    levier: 'Ressuscite un dossier perdu quand le contexte a changé — nouveau DSI, nouveau projet, nouveau budget.',
    valeur: 'Une source de pipeline entièrement nouvelle, à effort d’acquisition quasi nul.' },
  { n: 30, groupe: 'veille', name: 'Détection précoce d’insatisfaction (signaux faibles)',
    aujourdhui: 'Le risque d’attrition (#9) se déclenche surtout sur un signal financier — le retard de paiement.',
    levier: 'Capte des signaux plus faibles — silence inhabituel, ton des échanges, baisse d’engagement — avant le premier impayé.',
    valeur: 'Anticipe un risque comme celui de MTN CI plusieurs semaines avant qu’il ne devienne un problème financier.' },

  // -- Analyse : transformer le signal en chiffre exploitable --
  { n: 22, groupe: 'analyse', name: 'Business case chiffré généré automatiquement',
    aujourdhui: 'Un devis donne un prix, rarement une raison de signer maintenant.',
    levier: 'Compare le coût actuel estimé du client (parc connu + benchmarks sectoriels) au coût de la solution proposée. Chiffre les gains — réduction d’indisponibilité via SLA, mutualisation d’infrastructure, non-conformité ARTCI évitée — et le délai de retour sur investissement. Sortie : une page, 3-4 chiffres clés, prête pour la proposition.',
    valeur: 'Cycle de décision raccourci sur les gros comptes institutionnels (BCEAO, Trésor Public).' },
  { n: 25, groupe: 'analyse', name: 'Optimiseur d’allocation du temps commercial',
    aujourdhui: 'La priorisation quotidienne (#13) dit à chaque commercial quoi faire ; personne n’arbitre le temps entre commerciaux.',
    levier: 'Calcule un gain marginal par heure déplacée : compare le gain attendu côté destination (delta de probabilité de clôture × montant, issu de #1/#13) au coût d’opportunité côté origine. Ex. : « Déplacer 4h de Mariam S. (BAD, score faible) vers Koffi B. (BCEAO, score élevé) ».',
    valeur: 'Un arbitrage de portefeuille chiffré, en impact direct sur le pipeline pondéré attendu.' },
  { n: 26, groupe: 'analyse', name: 'Valeur vie client prédictive (CLV)',
    aujourdhui: 'Les décisions se prennent surtout sur la taille du deal immédiat.',
    levier: 'Formule : (revenu récurrent × marge) × durée de vie attendue (1 / taux de churn, #9) + espérance de cross-sell (#10) − coût de service. Un chiffre unique par compte, qui classe par valeur totale plutôt que par le deal du trimestre.',
    valeur: 'Réoriente l’effort commercial vers la valeur future, pas seulement le plus gros deal aujourd’hui.' },

  // -- Action : l'appui concret, prêt à utiliser tout de suite --
  { n: 21, groupe: 'action', name: 'Copilote de négociation en direct',
    aujourdhui: 'Le Pricing intelligent (#11) propose un prix avant le rendez-vous, mais rien n’aide le commercial pendant l’échange quand le client contre-propose.',
    levier: 'Le commercial tape la demande du client (ex. « -15% »), l’IA compare au plancher de marge (#11) et répond par une phrase prête à dire — ex. « Proposer -8% contre un engagement 24 mois au lieu de 12 : marge encore à 22% ».',
    valeur: '+3 à 5 pts de marge protégée sur les négociations serrées.' },
  { n: 23, groupe: 'action', name: 'Pitch et supports adaptés à l’interlocuteur',
    aujourdhui: 'Le Brief de RDV (#8) prépare le contexte, mais le support de présentation reste générique.',
    levier: 'Génère 3 versions d’un même brief : DSI (architecture, SLA, conformité ARTCI), DAF (le business case de #22, réutilisé tel quel), DG (positionnement, références SGBCI/BCEAO, enjeu souveraineté).',
    valeur: 'Discours mieux ciblé dès le premier rendez-vous sur les comptes à plusieurs décideurs (#17).' },
  { n: 24, groupe: 'action', name: 'Assistant de rédaction accéléré pour AO complexes',
    aujourdhui: 'Le Go/No-Go (#12) dit s’il faut y aller ; la rédaction reste ensuite entièrement manuelle.',
    levier: 'Ne reprend que les sections dont la formulation a été conservée sans changement dans un AO gagné (« prouvées ») — présentation, méthodologie générale, références. Le prix et l’analyse du besoin spécifique restent toujours écrits à la main.',
    valeur: 'Jours de rédaction économisés par AO — plus de dossiers traités avec la même équipe avant-vente.' },
];

/* ----------------------------------------------------------------------
   ATOMES
   ---------------------------------------------------------------------- */

function Fig({ v, size = '2rem', c = 'var(--dc-ink)' }) {
  return <span style={{ fontFamily: 'var(--dc-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: size, color: c, letterSpacing: '-0.02em' }}>{v}</span>;
}
function FnTag({ n, name }) {
  return (
    <div className="dc-fntag">
      {/* <span className="dc-fntag-n">Fonction IA #{n}</span> */}
      {/* <span className="dc-fntag-name">{name}</span> */}
    </div>
  );
}
function Pill({ tone = 'neutral', children, icon: Icon }) {
  return <span className={`dc-pill dc-pill-${tone}`}>{Icon && <Icon size={12} strokeWidth={2.5} />}{children}</span>;
}
function Ring({ value, size = 84, stroke = 9, color = 'var(--dc-gold)', label }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${label} : ${value} sur 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--dc-line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Fig v={value} size="1.3rem" />
      </div>
    </div>
  );
}

/* Recommandation — l'IA propose, l'utilisateur dispose (démo : latence simulée) */
function Reco({ n, name, action, why, gain, tone = 'info', confiance = 75, cta = 'Lancer l’action', doneMsg }) {
  const [state, setState] = useState('idle');
  const run = (loading, next) => { setState(loading); setTimeout(() => setState(next), 600); };
  return (
    <div className="dc-card dc-reco">
      <FnTag n={n} name={name} />
      <div className="dc-block-head">
        <span className="dc-reco-badge"><Sparkles size={12} strokeWidth={2.5} /> Prochaine meilleure action</span>
        <span className="dc-conf" style={{ color: confiance >= 80 ? 'var(--dc-ok)' : 'var(--dc-warn)' }}>{confiance}%</span>
      </div>
      <p className="dc-reco-action">{action}</p>
      <p className="dc-reco-why"><Info size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {why}</p>
      <div className="dc-reco-foot">
        <Pill tone={tone}>{gain}</Pill>
        {state === 'idle' && (
          <span className="dc-reco-actions">
            <button className="dc-btn dc-btn-ghost dc-btn-sm" onClick={() => run('loading-skip', 'skip')}>Ignorer</button>
            <button className="dc-btn dc-btn-primary dc-btn-sm" onClick={() => run('loading-go', 'go')}><ArrowRight size={13} />{cta}</button>
          </span>
        )}
        {(state === 'loading-go' || state === 'loading-skip') && (
          <span className="dc-reco-loading"><RefreshCw size={14} className="dc-spin" /> En cours…</span>
        )}
        {state === 'go' && <span className="dc-reco-done" style={{ color: 'var(--dc-ok)' }}><Check size={14} /> {doneMsg || 'Action lancée dans Odoo.'}</span>}
        {state === 'skip' && <span className="dc-reco-done" style={{ color: 'var(--dc-dim)' }}><X size={14} /> Écartée — appris pour la prochaine fois.</span>}
      </div>
    </div>
  );
}

/* Bloc prédiction (violet) — symétrique du bloc Reco (bleu) */
function Prediction({ n, name, titre, valeur, confiance, note, children }) {
  return (
    <div className="dc-card dc-pred">
      <FnTag n={n} name={name} />
      <div className="dc-block-head">
        <span className="dc-pred-badge"><TrendingUp size={12} strokeWidth={2.5} /> Prédiction IA</span>
        {confiance != null && <span className="dc-conf" style={{ color: confiance >= 80 ? 'var(--dc-ok)' : 'var(--dc-warn)' }}>{confiance}%</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 6px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: 'var(--dc-ink)' }}>{titre}</span>
        {valeur && <Fig v={valeur} size="1.35rem" c="var(--dc-pred)" />}
      </div>
      {children}
      {note && <p className="dc-reco-why" style={{ marginTop: 8 }}><Info size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {note}</p>}
    </div>
  );
}

function Spark({ hist, projLabel = 'Prédit', unit = '' }) {
  const w = 260, h = 56, pad = 6;
  const all = hist;
  const lo = Math.min(...all), hi = Math.max(...all);
  const x = (i) => pad + (i / (hist.length - 1)) * (w - 2 * pad);
  const y = (v) => h - pad - ((v - lo) / (hi - lo || 1)) * (h - 2 * pad);
  const splitAt = hist.length - 2;
  const plein = hist.slice(0, splitAt + 1);
  const pointille = hist.slice(splitAt);
  const pts = (arr, off) => arr.map((v, i) => `${x(off + i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label="Évolution observée et projection">
      <polyline points={pts(plein, 0)} fill="none" stroke="var(--dc-ink)" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={pts(pointille, splitAt)} fill="none" stroke="var(--dc-pred)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
      <circle cx={x(hist.length - 1)} cy={y(hist[hist.length - 1])} r="3" fill="var(--dc-pred)" />
    </svg>
  );
}

function TargetGauge({ valeur, cible, unite = '', max }) {
  const m = max || cible * 1.4;
  const pc = (v) => `${Math.max(0, Math.min(100, (v / m) * 100))}%`;
  const ok = valeur <= cible * 1.05;
  return (
    <div>
      <div style={{ position: 'relative', height: 10, background: 'var(--dc-paper)', borderRadius: 6, border: '1px solid var(--dc-line)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pc(valeur), background: ok ? 'var(--dc-ok)' : 'var(--dc-warn)', borderRadius: 6 }} />
        <div style={{ position: 'absolute', left: pc(cible), top: -3, bottom: -3, width: 2, background: 'var(--dc-ink)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.78rem', color: 'var(--dc-dim)' }}>
        <span>Recommandé <Fig v={`${valeur}${unite}`} size="0.95rem" c={ok ? 'var(--dc-ok)' : 'var(--dc-warn)'} /></span>
        <span>Repère historique <Fig v={`${cible}${unite}`} size="0.95rem" /></span>
      </div>
    </div>
  );
}

/* Carte « levier proposé » — pas encore actif : on affiche l'angle mort
   qu'il couvre (pertinence) et l'impact attendu (valeur ajoutée), jamais
   de faux bouton « Lancer » puisque rien ne tourne encore côté Odoo. */
function LeverCard({ n, name, accent, aujourdhui, levier, valeur }) {
  return (
    <div className="dc-card dc-lever" style={{ '--accent': accent }}>
      <div className="dc-lever-top">
        <span className="dc-lever-tag">Levier #{n}</span>
        <span className="dc-lever-status">Proposé</span>
      </div>
      <p className="dc-lever-name">{name}</p>
      <div className="dc-lever-row"><span className="dc-lever-k">Aujourd’hui</span><p>{aujourdhui}</p></div>
      <div className="dc-lever-row"><span className="dc-lever-k">Levier IA</span><p>{levier}</p></div>
      <div className="dc-lever-value"><ArrowUpRight size={14} /> {valeur}</div>
    </div>
  );
}

/* ----------------------------------------------------------------------
   APP
   ---------------------------------------------------------------------- */
export default function DirecteurCommercialDashboard() {
  const [showSubnav, setShowSubnav] = useState(false);
  const [sim, setSim] = useState({ sgbci: false, tresor: false });
  const [leverTab, setLeverTab] = useState('veille');
  const scrollRef = useRef(null);
  const refs = { piloter: useRef(null), agir: useRef(null), anticiper: useRef(null), developper: useRef(null), progresser: useRef(null), leviers: useRef(null) };

  // Le dashboard vit dans un conteneur scrollable (AppShell met <main> en
  // overflow-hidden) : on lit donc le scroll du conteneur, pas de window.
  const handleScroll = (e) => setShowSubnav(e.currentTarget.scrollTop > 520);

  const goTo = (key) => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    refs[key].current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  // simulation de clôture (fonction #15)
  let simTotal = SECURISE + PONDERE_IA;
  if (sim.sgbci) simTotal += OPPORTUNITES[1].montant * (1 - OPPORTUNITES[1].probIA);
  if (sim.tresor) simTotal -= OPPORTUNITES[0].montant * OPPORTUNITES[0].probIA;
  const simEcart = Math.round(simTotal - OBJECTIF);

  const dormants = OPPORTUNITES.filter((o) => o.jours > 30).sort((a, b) => b.jours - a.jours);

  return (
    <div className="dc-root" ref={scrollRef} onScroll={handleScroll} style={{ height: '100%', overflowY: 'auto' }}>
      <style>{CSS}</style>

      {/* -- sous-navigation flottante -- */}
      <nav className={`dc-subnav ${showSubnav ? 'is-visible' : ''}`} aria-label="Navigation rapide">
        <button className="dc-subnav-item dc-subnav-item-new" style={{ '--accent': '#BE3455' }} onClick={() => goTo('leviers')}><Lightbulb size={12} /> Le prochain palier</button>
        {CHIP_GROUPS.map((g) => (
          <button key={g.key} className="dc-subnav-item" style={{ '--accent': g.accent }} onClick={() => goTo(g.key)}>{g.title}</button>
        ))}
      </nav>

      <div className="dc-shell">
        {/* -- en-tête / hero -- */}
        {/* <header className="dc-header dc-fade" style={{ '--d': '0s' }}>
          <div className="dc-eyebrow"><Building2 size={13} /> Neurones Technologies · Direction Commerciale</div>
          <h1 className="dc-title">20 façons de ne plus <em>deviner</em>.</h1>
          <p className="dc-sub">Le tableau de bord IA de la Direction Commerciale — chaque chiffre sourcé, chaque recommandation actionnable en un clic, jamais un écran de plus à ouvrir dans Odoo.</p>
        </header> */}

        {/* -- VEILLE / ANALYSE / ACTION — en tête de page -- */}
        {/* <section className="dc-section dc-section-proposed dc-fade" ref={refs.leviers} style={{ scrollMarginTop: 84, borderTop: 'none', paddingTop: 8, '--d': '0.04s' }}> */}
          {/* <div className="dc-section-head" style={{ '--accent': '#BE3455' }}>
            <span className="dc-section-eyebrow"><Lightbulb size={12} /> Proposition — en attente de validation</span>
            <h2 className="dc-h2">Le prochain palier</h2>
            <p className="dc-section-desc">10 leviers supplémentaires, pensés pour renforcer la prise de décision du Directeur Commercial et l’impact direct sur le chiffre d’affaires. Organisés en trois temps — <b>Veille</b> (repérer le signal), <b>Analyse</b> (le chiffrer), <b>Action</b> (l’appui prêt à l’emploi) — chacun part d’une limite précise des 20 fonctions actives présentées plus bas.</p>
          </div> */}
{/* 
          <div className="dc-lever-tabs" role="tablist" aria-label="Catégories de leviers proposés">
            {LEVIER_GROUPS.map((g) => {
              const count = LEVIERS.filter((l) => l.groupe === g.key).length;
              return (
                <button
                  key={g.key}
                  role="tab"
                  aria-selected={leverTab === g.key}
                  className={`dc-lever-tab ${leverTab === g.key ? 'is-active' : ''}`}
                  style={{ '--accent': g.accent }}
                  onClick={() => setLeverTab(g.key)}
                >
                  <Compass size={14} /> {g.title} <span className="dc-lever-tab-count">{count}</span>
                </button>
              );
            })}
          </div>

          {LEVIER_GROUPS.filter((g) => g.key === leverTab).map((g) => (
            <div key={g.key} className="dc-fade">
              <p className="dc-lever-tagline-full" style={{ '--accent': g.accent }}>{g.tagline}</p>
              <div className="dc-lever-grid">
                {LEVIERS.filter((l) => l.groupe === g.key).map((l) => (
                  <LeverCard key={l.n} accent={g.accent} {...l} />
                ))}
              </div>
            </div>
          ))}
        </section> */}

        {/* -- KPI strip -- */}
        <section className="dc-kpis dc-fade" style={{ '--d': '0.08s' }}>
          <div className="dc-kpi">
            <div className="dc-kpi-label"><Wallet size={13} /> Pipeline pondéré (corrigé IA)</div>
            <Fig v={fmt(PONDERE_IA)} size="1.8rem" />
            <div className="dc-kpi-sub">sur {fmt(OBJECTIF)} visés ce trimestre</div>
          </div>
          <div className="dc-kpi dc-kpi-ring">
            <div className="dc-kpi-label"><Gauge size={13} /> Santé du pipeline commercial</div>
            <Ring value={68} color="var(--dc-gold)" label="Score de santé" />
            <div className="dc-kpi-sub">Vigilance · +3 pts vs semaine dernière</div>
          </div>
          <div className="dc-kpi">
            <div className="dc-kpi-label"><TrendingUp size={13} /> Conversion à 90 jours</div>
            <Fig v="63%" size="1.8rem" c="var(--dc-ok)" />
            <div className="dc-kpi-sub">+4 pts vs les 90 jours précédents</div>
          </div>
          <div className="dc-kpi">
            <div className="dc-kpi-label"><Bell size={13} /> Alertes actives</div>
            <Fig v="6" size="1.8rem" c="var(--dc-danger)" />
            <div className="dc-kpi-sub">dossiers dormants, risque client, concurrence</div>
          </div>
        </section>

        {/* -- grille signature : les 20 fonctions -- */}
        {/* <section className="dc-fade" style={{ '--d': '0.16s' }}> */}
          {/* <div className="dc-grid-head"> */}
            {/* <h2 className="dc-h2">Les 20 fonctions actives</h2> */}
            {/* <p className="dc-grid-sub">Organisées en 5 familles. Cliquez une famille pour y aller directement.</p> */}
          {/* </div> */}
          {/* <div className="dc-clusters">
            {CHIP_GROUPS.map((g) => (
              <div key={g.key} className="dc-cluster" style={{ '--accent': g.accent }} onClick={() => goTo(g.key)}>
                <div className="dc-cluster-title">{g.title}</div>
                <div className="dc-chip-grid">
                  {g.items.map((it) => (
                    <div key={it.n} className="dc-chip" title={it.name}>
                      <span className="dc-chip-n">{it.n}</span>
                      <span className="dc-chip-name">{it.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div> */}
        {/* </section> */}

        {/* -- A. PILOTER LE TRIMESTRE -- */}
        <section className="dc-section" ref={refs.piloter} style={{ scrollMarginTop: 84 }}>
          <div className="dc-section-head" style={{ '--accent': '#F0A93B' }}>
            <span className="dc-section-eyebrow">Famille 1 / 5</span>
            <h2 className="dc-h2">Piloter le trimestre</h2>
            <p className="dc-section-desc">La vue que le Directeur Commercial ouvre en premier chaque matin.</p>
          </div>

          <div className="dc-cols-2">
            <div className="dc-card">
              <FnTag n={2} name="Prévision d’atterrissage du trimestre" />
              <div className="dc-landing">
                <div className="dc-landing-bar">
                  <div className="dc-landing-seg dc-landing-secured" style={{ width: `${(SECURISE / (OBJECTIF * 1.05)) * 100}%` }} />
                  <div className="dc-landing-seg dc-landing-pred" style={{ left: `${(SECURISE / (OBJECTIF * 1.05)) * 100}%`, width: `${(PONDERE_IA / (OBJECTIF * 1.05)) * 100}%` }} />
                  <div className="dc-landing-target" style={{ left: `${(OBJECTIF / (OBJECTIF * 1.05)) * 100}%` }} />
                </div>
                <div className="dc-landing-legend">
                  <span><i className="dc-dot" style={{ background: 'var(--dc-ink)' }} /> Sécurisé <Fig v={fmt(SECURISE)} size="0.9rem" /></span>
                  <span><i className="dc-dot" style={{ background: 'var(--dc-pred)' }} /> Prévision IA <Fig v={fmt(PONDERE_IA)} size="0.9rem" c="var(--dc-pred)" /></span>
                  <span><i className="dc-dot" style={{ background: 'var(--dc-danger)' }} /> Objectif <Fig v={fmt(OBJECTIF)} size="0.9rem" /></span>
                  <span className="dc-landing-ecart" style={{ color: ECART >= 0 ? 'var(--dc-ok)' : 'var(--dc-warn)' }}>Écart {ECART >= 0 ? '+' : ''}<Fig v={fmt(ECART)} size="0.9rem" c={ECART >= 0 ? 'var(--dc-ok)' : 'var(--dc-warn)'} /></span>
                </div>
              </div>
              <p className="dc-reco-why" style={{ marginTop: 12 }}><Info size={13} /> Calculée à partir du pipeline pondéré recalculé par l’IA (fonction #1 ci-dessous), pas des probabilités déclarées.</p>
            </div>

            <div className="dc-card">
              <FnTag n={1} name="Scoring prédictif des opportunités" />
              <div className="dc-cbars">
                {OPPORTUNITES.map((o) => {
                  const d = o.montant * o.prob, ia = o.montant * o.probIA, ecart = ia - d;
                  const max = Math.max(...OPPORTUNITES.map((x) => Math.max(x.montant * x.prob, x.montant * x.probIA)));
                  return (
                    <div key={o.id} className="dc-cbar-row">
                      <div className="dc-cbar-label">
                        <span>{o.client}</span>
                        <span style={{ color: ecart >= 0 ? 'var(--dc-ok)' : 'var(--dc-danger)' }}>{ecart >= 0 ? '+' : '−'}{fmt(Math.abs(ecart))}</span>
                      </div>
                      <div className="dc-cbar-track"><div className="dc-cbar-fill dc-cbar-declare" style={{ width: `${(d / max) * 100}%` }} /></div>
                      <div className="dc-cbar-track"><div className="dc-cbar-fill dc-cbar-ia" style={{ width: `${(ia / max) * 100}%` }} /></div>
                    </div>
                  );
                })}
                <div className="dc-landing-legend" style={{ marginTop: 4 }}>
                  <span><i className="dc-dot" style={{ background: 'var(--dc-ink)', opacity: 0.3 }} /> Déclaré</span>
                  <span><i className="dc-dot" style={{ background: 'var(--dc-pred)' }} /> Recalculé par l’IA</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dc-cols-2">
            <div className="dc-card">
              <FnTag n={15} name="Simulation de scénarios de clôture" />
              <p className="dc-reco-action" style={{ fontSize: '0.95rem' }}>Testez deux hypothèses en direct :</p>
              <div className="dc-sim-toggles">
                <button className={`dc-toggle ${sim.sgbci ? 'is-on' : ''}`} onClick={() => setSim((s) => ({ ...s, sgbci: !s.sgbci }))}>
                  <span>SGBCI signe cette semaine</span><span className="dc-toggle-switch" />
                </button>
                <button className={`dc-toggle ${sim.tresor ? 'is-on' : ''}`} onClick={() => setSim((s) => ({ ...s, tresor: !s.tresor }))}>
                  <span>Trésor Public glisse au trimestre suivant</span><span className="dc-toggle-switch" />
                </button>
              </div>
              <div className="dc-sim-result">
                <span>Atterrissage simulé</span>
                <Fig v={fmt(simTotal)} size="1.5rem" c={simEcart >= 0 ? 'var(--dc-ok)' : 'var(--dc-warn)'} />
                <span style={{ color: simEcart >= 0 ? 'var(--dc-ok)' : 'var(--dc-warn)' }}>{simEcart >= 0 ? '+' : ''}{fmt(simEcart)} vs objectif</span>
              </div>
            </div>

            <div className="dc-card">
              <FnTag n={13} name="Priorisation quotidienne du portefeuille" />
              <ol className="dc-ranklist">
                <li><span className="dc-rank-n">1</span><span className="dc-rank-name">Trésor Public CI</span><span className="dc-rank-who">Awa D.</span><Pill tone="danger">2 100 M en jeu</Pill></li>
                <li><span className="dc-rank-n">2</span><span className="dc-rank-name">MTN CI</span><span className="dc-rank-who">Koffi B.</span><Pill tone="warn">Impayé + churn</Pill></li>
                <li><span className="dc-rank-n">3</span><span className="dc-rank-name">SGBCI</span><span className="dc-rank-who">Awa D.</span><Pill tone="info">38 j sans mouvement</Pill></li>
              </ol>
            </div>
          </div>
        </section>

        {/* -- B. AGIR, DOSSIER PAR DOSSIER -- */}
        <section className="dc-section" ref={refs.agir} style={{ scrollMarginTop: 84 }}>
          <div className="dc-section-head" style={{ '--accent': '#2563EB' }}>
            <span className="dc-section-eyebrow">Famille 2 / 5</span>
            <h2 className="dc-h2">Agir, dossier par dossier</h2>
            <p className="dc-section-desc">Jamais un simple constat : toujours un geste concret, prêt à lancer.</p>
          </div>

          <div className="dc-cols-3">
            <Reco n={3} name="Prochaine meilleure action (NBA)" tone="info" confiance={81}
              action="Relancer SGBCI via le sponsor DSI, pas les achats." why="38 j sans mouvement ; le décret ARTCI redonne un angle souveraineté à faire valoir maintenant."
              gain="Débloque 480 M" doneMsg="Activité créée dans Odoo — assignée à Awa D." />
            <Reco n={3} name="Prochaine meilleure action (NBA)" tone="warn" confiance={77}
              action="Proposer un échéancier de paiement à MTN CI avant la prochaine relance commerciale." why="Facture en retard de 45 j ; le compte reste stratégique pour le cross-sell cloud."
              gain="Sécurise 320 M et limite le churn" doneMsg="Activité créée dans Odoo — assignée à Koffi B." />
            <Reco n={3} name="Prochaine meilleure action (NBA)" tone="ok" confiance={68}
              action="Envoyer l’argumentaire de différenciation technique à Orange CI (compte partenaire) avant leur riposte." why="Positionnement cloud rival détecté par la veille concurrentielle (fonction #18)."
              gain="Protège 250 M à faible risque" doneMsg="Brouillon d’email créé — à valider." />
          </div>

          <div className="dc-cols-2">
            <div className="dc-card">
              <FnTag n={4} name="Détection du pipeline fictif" />
              <div className="dc-dormants">
                {dormants.map((o) => (
                  <div key={o.id} className="dc-dormant-row">
                    <span className="dc-dormant-client">{o.client}</span>
                    <span className="dc-dormant-days"><Clock size={12} /> {o.jours} j sans mouvement</span>
                    <Pill tone={o.jours > 50 ? 'danger' : 'warn'}>À revoir</Pill>
                  </div>
                ))}
              </div>
            </div>

            <div className="dc-card">
              <FnTag n={19} name="Génération de relances contextualisées" />
              <div className="dc-email">
                <div className="dc-email-line"><b>À :</b> Direction des Systèmes d’Information — Trésor Public CI</div>
                <div className="dc-email-line"><b>Objet :</b> Hébergement souverain — anticiper le décret ARTCI</div>
                <p className="dc-email-body">« Suite à nos échanges, et dans la perspective du décret sur l’hébergement souverain, nous proposons un point technique cette semaine pour sécuriser votre feuille de route 2026-2027… »</p>
              </div>
              <div className="dc-reco-foot" style={{ marginTop: 10 }}>
                <Pill tone="info">Brouillon généré par l’IA</Pill>
                <span className="dc-reco-actions"><button className="dc-btn dc-btn-ghost dc-btn-sm">Modifier</button><button className="dc-btn dc-btn-primary dc-btn-sm"><Send size={13} />Envoyer</button></span>
              </div>
            </div>
          </div>

          {/* <div className="dc-card">
            <FnTag n={14} name="Compte-rendu vocal → CRM structuré" />
            <div className="dc-voice">
              <div className="dc-voice-mic"><Mic size={20} /></div>
              <div className="dc-voice-wave">{Array.from({ length: 28 }).map((_, i) => <span key={i} style={{ height: 6 + Math.abs(Math.sin(i * 0.9)) * 22 }} />)}</div>
              <div className="dc-voice-arrow"><ChevronRight size={18} /></div>
              <div className="dc-voice-result">CRM mis à jour — SGBCI : « attend un devis révisé, décision vendredi » · activité créée pour Awa D.</div>
            </div>
          </div> */}
        </section>

        {/* -- C. ANTICIPER LES RISQUES -- */}
        <section className="dc-section" ref={refs.anticiper} style={{ scrollMarginTop: 84 }}>
          <div className="dc-section-head" style={{ '--accent': '#7C3AED' }}>
            <span className="dc-section-eyebrow">Famille 3 / 5</span>
            <h2 className="dc-h2">Anticiper, avant que ça devienne un problème</h2>
            <p className="dc-section-desc">Clients, concurrence, disponibilité des équipes : tout est vu tôt.</p>
          </div>

          <div className="dc-cols-2">
            <Prediction n={9} name="Détection du risque d’attrition (churn)" titre="MTN Côte d’Ivoire" valeur="72%" confiance={74}
              note="Facture de 320 M en retard de 45 j ; commandes en baisse de 30% sur le trimestre.">
              <Spark hist={[92, 88, 81, 74, 68, 60, 55]} unit="/100" />
              <div className="dc-legend-row"><span><i className="dc-dot" style={{ background: 'var(--dc-ink)' }} /> Score de solvabilité observé</span><span><i className="dc-dot" style={{ background: 'var(--dc-pred)' }} /> Projection</span></div>
            </Prediction>

            <div className="dc-card">
              <FnTag n={18} name="Alertes concurrence" />
              <div className="dc-feed">
                <div className="dc-feed-item">
                  <Newspaper size={14} className="dc-feed-icon" />
                  <div><b>Orange CI</b> lance une offre cloud souverain concurrente, prix ~12% sous le nôtre. <span className="dc-feed-meta">Veille presse · il y a 2 j</span></div>
                </div>
                <div className="dc-feed-item">
                  <Newspaper size={14} className="dc-feed-icon" />
                  <div><b>INOVA-CI</b> confirmé comme 3ᵉ répondant sur l’AO Trésor Public. <span className="dc-feed-meta">Dossier de consultation · il y a 5 j</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="dc-cols-2">
            <div className="dc-card">
              <FnTag n={17} name="Cartographie des décideurs et sponsors" />
              <div className="dc-contact-map">
                <div className="dc-contact ok"><UserCheck size={16} /><div><b>Directeur des Systèmes d’Information</b><span>Sponsor identifié · favorable</span></div><Pill tone="ok">82% confiance</Pill></div>
                <div className="dc-contact warn"><Users size={16} /><div><b>Service Achats</b><span>Bloque sur le prix · non décisionnaire</span></div><Pill tone="neutral">Contact secondaire</Pill></div>
              </div>
              <p className="dc-reco-why" style={{ marginTop: 10 }}><Info size={13} /> Compte : Trésor Public CI — reconstitué à partir des comptes rendus de rendez-vous.</p>
            </div>

            <div className="dc-card">
              <FnTag n={5} name="Radar bench → pipeline" />
              <div className="dc-tl">
                <div className="dc-tl-axis"><span /><span>Aujourd’hui</span><span>+20 j</span><span>+40 j</span></div>
                {[
                  { nom: 'Ingénieur Réseau B', fin: 6, deb: 9, match: 'SGBCI' },
                  { nom: 'Consultant Odoo C', fin: 18, deb: null, match: null },
                  { nom: 'Architecte Cloud D', fin: 32, deb: 38, match: 'Trésor Public CI' },
                ].map((r) => (
                  <div className="dc-tl-row" key={r.nom}>
                    <span className="dc-tl-name">{r.nom}</span>
                    <div className="dc-tl-bar">
                      <div className="dc-tl-seg dc-tl-mission" style={{ width: `${(r.fin / 40) * 100}%` }} />
                      {r.deb != null && <div className="dc-tl-seg dc-tl-match" style={{ left: `${(r.fin / 40) * 100}%`, width: `${((r.deb - r.fin) / 40) * 100}%` }} />}
                      {r.deb == null && <div className="dc-tl-seg dc-tl-gap" style={{ left: `${(r.fin / 40) * 100}%`, right: 0 }} />}
                    </div>
                    <span className="dc-tl-tag">{r.match ? `→ ${r.match}` : 'bench prédit'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* -- D. VENDRE PLUS SUR L'EXISTANT -- */}
        <section className="dc-section" ref={refs.developper} style={{ scrollMarginTop: 84 }}>
          <div className="dc-section-head" style={{ '--accent': '#0E7C86' }}>
            <span className="dc-section-eyebrow">Famille 4 / 5</span>
            <h2 className="dc-h2">Vendre plus, sur ce qu’on a déjà</h2>
            <p className="dc-section-desc">Base installée, tarification, appels d’offres : chaque euro de plus est identifié.</p>
          </div>

          <div className="dc-cols-3">
            <div className="dc-card">
              <FnTag n={10} name="Cross-sell / up-sell" />
              <div className="dc-xsell">
                {[{ c: 'SGBCI', a: 'Intégration réseau', o: 'Managed services 24/7', m: 180, p: 60 },
                  { c: 'BCEAO', a: 'Support logiciel', o: 'Hébergement souverain', m: 420, p: 45 },
                  { c: 'Société Générale CI', a: 'Contrat managed', o: 'Upgrade infra cloud', m: 250, p: 55 }].map((x) => (
                  <div key={x.c} className="dc-xsell-row">
                    <div><b>{x.c}</b><span className="dc-feed-meta">{x.a} → {x.o}</span></div>
                    <Fig v={fmt(x.m)} size="0.95rem" /><span className="dc-feed-meta">{x.p}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dc-card">
              <FnTag n={11} name="Pricing intelligent" />
              <p className="dc-reco-action" style={{ fontSize: '0.9rem' }}>Devis SGBCI — managed services</p>
              <TargetGauge valeur={92} cible={98} unite=" k FCFA/j" max={130} />
              <p className="dc-reco-why" style={{ marginTop: 10 }}><Info size={13} /> TJM recommandé sous le repère historique pour sécuriser la signature sans éroder la marge cible.</p>
            </div>

            <div className="dc-card">
              <FnTag n={12} name="Go/No-Go automatisé sur AO" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Ring value={71} color="var(--dc-ok)" label="Bid score" />
                <div>
                  <Pill tone="ok" icon={CheckCircle2}>GO recommandé</Pill>
                  <p className="dc-feed-meta" style={{ marginTop: 6 }}>Ministère du Budget — modernisation SI (2,4 Md FCFA)</p>
                </div>
              </div>
            </div>
          </div>

          <div className="dc-cols-2">
            <div className="dc-card">
              <FnTag n={6} name="Veille AO automatisée" />
              <div className="dc-feed">
                <div className="dc-feed-item"><Search size={14} className="dc-feed-icon" /><div>Avis publié sur <b>marchespublics.ci</b> : audit de sécurité des systèmes d’information, Ministère du Budget. <span className="dc-feed-meta">SIGOMAP · il y a 1 j</span></div></div>
                <div className="dc-feed-item"><Search size={14} className="dc-feed-icon" /><div>AGPM <b>Banque mondiale</b> : projet d’appui à la digitalisation de l’administration — marchés attendus sous 4 mois. <span className="dc-feed-meta">STEP · il y a 6 j</span></div></div>
                <div className="dc-feed-item"><Search size={14} className="dc-feed-icon" /><div>Enveloppe <b>BAD</b> — digitalisation des douanes UEMOA, 1,8 Md FCFA. <span className="dc-feed-meta">Dépôt dans 21 j</span></div></div>
                <div className="dc-feed-item"><Search size={14} className="dc-feed-icon" /><div>Publication imminente du <b>décret ARTCI</b> — hébergement souverain. <span className="dc-feed-meta">Fenêtre 2026-2027</span></div></div>
              </div>
              <div className="dc-sources">
                <span className="dc-sources-label">Sources surveillées</span>
                <span className="dc-source-tag">marchespublics.ci / SIGOMAP</span>
                <span className="dc-source-tag">ARCOP</span>
                <span className="dc-source-tag">Banque mondiale — STEP / AGPM</span>
                <span className="dc-source-tag">BAD — avis + RSS</span>
                <span className="dc-source-tag">AFD — projets Côte d’Ivoire</span>
              </div>
            </div>
            <div className="dc-card">
              <FnTag n={20} name="Prévision de charge avant-vente" />
              <div className="dc-tbars">
                {[{ m: 'Juil', v: 3 }, { m: 'Août', v: 5 }, { m: 'Sept', v: 4 }, { m: 'Oct*', v: 7, proj: true }].map((d) => (
                  <div key={d.m} className="dc-tbar-col">
                    <span className="dc-tbar-val" style={{ color: d.proj ? 'var(--dc-pred)' : 'var(--dc-ink)' }}>{d.v}</span>
                    <div className="dc-tbar" style={{ height: d.v * 10, background: d.proj ? 'repeating-linear-gradient(45deg, var(--dc-pred), var(--dc-pred) 4px, #E4D9F7 4px, #E4D9F7 8px)' : 'var(--dc-ink)' }} />
                    <span className="dc-tbar-label">{d.m}</span>
                  </div>
                ))}
              </div>
              <p className="dc-reco-why" style={{ marginTop: 8 }}><Info size={13} /> * Octobre est une projection — l’équipe avant-vente est sous-dimensionnée de 2 profils face au flux attendu.</p>
            </div>
          </div>
        </section>

        {/* -- E. FAIRE PROGRESSER L'ÉQUIPE -- */}
        <section className="dc-section" ref={refs.progresser} style={{ scrollMarginTop: 84 }}>
          <div className="dc-section-head" style={{ '--accent': '#5B6472' }}>
            <span className="dc-section-eyebrow">Famille 5 / 5</span>
            <h2 className="dc-h2">Faire progresser l’équipe</h2>
            <p className="dc-section-desc">Ce que l’IA a appris de chaque contrat, gagné ou perdu.</p>
          </div>

          <div className="dc-cols-2">
            <div className="dc-card">
              <FnTag n={7} name="Analyse win/loss automatique" />
              <div className="dc-cbars">
                {[{ l: 'Prix', w: 3, p: 5 }, { l: 'Références', w: 6, p: 1 }, { l: 'Délai', w: 2, p: 3 }, { l: 'Sponsor', w: 4, p: 1 }].map((r) => (
                  <div key={r.l} className="dc-cbar-row">
                    <div className="dc-cbar-label"><span>{r.l}</span><span className="dc-feed-meta">{r.w} gagnés · {r.p} perdus</span></div>
                    <div className="dc-cbar-track"><div className="dc-cbar-fill" style={{ width: `${(r.w / (r.w + r.p)) * 100}%`, background: 'var(--dc-ok)' }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="dc-card">
              <FnTag n={16} name="Coaching commercial par l’IA" />
              <div className="dc-coach">
                {[{ n: 'Awa D.', s: 82, t: 'Excelle en clôture — style relance rapide et directe.' },
                  { n: 'Koffi B.', s: 61, t: 'Propose souvent une remise trop tôt en négociation.' },
                  { n: 'Mariam S.', s: 55, t: 'Cycle 40% plus long que la moyenne — qualification à renforcer.' }].map((c) => (
                  <div key={c.n} className="dc-coach-row">
                    <span className="dc-coach-name">{c.n}</span>
                    <div className="dc-coach-bar"><div style={{ width: `${c.s}%`, background: c.s >= 70 ? 'var(--dc-ok)' : c.s >= 55 ? 'var(--dc-warn)' : 'var(--dc-danger)' }} /></div>
                    <span className="dc-coach-tip">{c.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dc-card">
            <FnTag n={8} name="Brief de rendez-vous auto" />
            <div className="dc-brief">
              <div className="dc-brief-head"><PhoneCall size={16} /><b>SGBCI</b><span className="dc-feed-meta">RDV demain, 10h · Awa D.</span></div>
              <p className="dc-brief-line"><Layers size={13} /> Dernier échange : attend un devis révisé sur les managed services, décision annoncée pour vendredi.</p>
              <p className="dc-brief-line"><Shield size={13} /> Angle recommandé : sécuriser le prix (fonction #11) avant d’aborder l’extension du périmètre.</p>
            </div>
          </div>
        </section>

        {/* <footer className="dc-footer">
          <div className="dc-footer-line"><ListChecks size={14} /> 20 fonctions IA affichées sur 20 — catalogue complet du pôle Commercial, Neurones Technologies.</div>
          <div className="dc-footer-line dc-footer-line-new"><Lightbulb size={14} /> + 10 leviers proposés en tête de page pour aller plus loin, en attente de validation avant implémentation.</div>
        </footer> */}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------
   STYLES
   ---------------------------------------------------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,900;1,9..144,600&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600;700&display=swap');

.dc-root{
  --dc-ink:#0B1220; --dc-dim:#5B6472; --dc-faint:#94A0B0;
  --dc-paper:#F5F6F8; --dc-panel:#FFFFFF; --dc-line:#E3E7EE;
  --dc-gold:#F0A93B; --dc-gold-ink:#8A5A12;
  --dc-info:#2563EB; --dc-pred:#7C3AED; --dc-teal:#0E7C86;
  --dc-ok:#0F8A54; --dc-warn:#B36B00; --dc-danger:#C6102A;
  --dc-sans:'Inter',system-ui,sans-serif; --dc-display:'Fraunces',Georgia,serif; --dc-mono:'IBM Plex Mono',ui-monospace,monospace;
  font-family:var(--dc-sans); background:var(--dc-paper); color:var(--dc-ink);
  min-height:100%; padding:0 0 40px;
}
.dc-root *{ box-sizing:border-box; }
.dc-root :focus-visible{ outline:2px solid var(--dc-info); outline-offset:2px; border-radius:4px; }
.dc-shell{ max-width:1180px; margin:0 auto; padding:28px 20px 0; }

/* header */
.dc-eyebrow{ display:flex; align-items:center; gap:6px; font-size:0.78rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--dc-dim); }
.dc-title{ font-family:var(--dc-display); font-weight:900; font-size:clamp(2rem,5vw,3.4rem); line-height:1.05; margin:10px 0 12px; letter-spacing:-0.01em; }
.dc-title em{ font-style:italic; color:var(--dc-gold-ink); }
.dc-sub{ max-width:640px; color:var(--dc-dim); font-size:1rem; line-height:1.55; margin:0; }

/* KPI strip */
.dc-kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin:28px 0; }
.dc-kpi{ background:var(--dc-panel); border:1px solid var(--dc-line); border-radius:14px; padding:18px; box-shadow:0 1px 2px rgba(11,18,32,.04); }
.dc-kpi-ring{ display:flex; flex-direction:column; align-items:flex-start; }
.dc-kpi-ring > *:nth-child(2){ align-self:center; margin:4px 0; }
.dc-kpi-label{ display:flex; align-items:center; gap:6px; font-size:0.74rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--dc-dim); margin-bottom:8px; }
.dc-kpi-sub{ font-size:0.78rem; color:var(--dc-faint); margin-top:4px; }

/* hero grid (20 fonctions) */
.dc-grid-head{ display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
.dc-h2{ font-family:var(--dc-display); font-weight:600; font-size:1.5rem; margin:0; }
.dc-grid-sub{ color:var(--dc-faint); font-size:0.85rem; margin:0; }
.dc-clusters{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin-bottom:36px; }
.dc-cluster{ background:var(--dc-panel); border:1px solid var(--dc-line); border-left:4px solid var(--accent); border-radius:12px; padding:14px 16px; cursor:pointer; transition:transform .15s, box-shadow .15s; }
.dc-cluster:hover{ transform:translateY(-2px); box-shadow:0 8px 20px rgba(11,18,32,.08); }
.dc-cluster-title{ font-weight:700; font-size:0.92rem; margin-bottom:10px; }
.dc-chip-grid{ display:flex; flex-direction:column; gap:6px; }
.dc-chip{ display:flex; align-items:center; gap:8px; font-size:0.8rem; color:var(--dc-dim); }
.dc-chip-n{ display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:6px; background:var(--accent); color:#fff; font-family:var(--dc-mono); font-weight:700; font-size:0.68rem; flex-shrink:0; }
.dc-chip-name{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* subnav */
.dc-subnav{ position:sticky; top:0; z-index:20; display:flex; gap:6px; flex-wrap:wrap; padding:10px 20px; background:rgba(245,246,248,.9); backdrop-filter:blur(6px); border-bottom:1px solid var(--dc-line); transform:translateY(-120%); transition:transform .25s ease; max-width:1180px; margin:0 auto; }
.dc-subnav.is-visible{ transform:translateY(0); }
.dc-subnav-item{ font-family:var(--dc-sans); font-size:0.78rem; font-weight:600; padding:6px 12px; border-radius:999px; border:1px solid var(--dc-line); background:#fff; color:var(--dc-ink); cursor:pointer; border-left:3px solid var(--accent); }
.dc-subnav-item:hover{ background:var(--dc-paper); }

/* sections */
.dc-section{ padding:44px 0 8px; border-top:1px solid var(--dc-line); }
.dc-section-head{ margin-bottom:18px; }
.dc-section-eyebrow{ display:inline-flex; align-items:center; gap:5px; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--accent); }
.dc-section-desc{ color:var(--dc-dim); margin:4px 0 0; font-size:0.92rem; }

.dc-cols-2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
.dc-cols-3{ display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:16px; }

.dc-card{ background:var(--dc-panel); border:1px solid var(--dc-line); border-radius:14px; padding:18px; }

.dc-fntag{ display:flex; align-items:baseline; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
.dc-fntag-n{ font-family:var(--dc-mono); font-size:0.68rem; font-weight:700; color:#fff; background:var(--dc-ink); padding:2px 8px; border-radius:999px; letter-spacing:.02em; }
.dc-fntag-name{ font-size:0.82rem; font-weight:700; color:var(--dc-dim); }

.dc-block-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
.dc-conf{ font-family:var(--dc-mono); font-weight:700; font-size:0.8rem; }

/* Reco (bleu) / Prediction (violet) */
.dc-reco{ border-left:3px solid var(--dc-info); background:#F7FAFF; }
.dc-pred{ border-left:3px solid var(--dc-pred); background:#FAF8FE; }
.dc-reco-badge{ display:inline-flex; align-items:center; gap:5px; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--dc-info); }
.dc-pred-badge{ display:inline-flex; align-items:center; gap:5px; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--dc-pred); }
.dc-reco-action{ font-weight:700; margin:8px 0 6px; line-height:1.4; }
.dc-reco-why{ display:flex; gap:6px; font-size:0.85rem; color:var(--dc-dim); margin:0; line-height:1.5; }
.dc-reco-foot{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:12px; }
.dc-reco-actions{ display:flex; gap:8px; margin-left:auto; }
.dc-reco-loading{ margin-left:auto; display:flex; align-items:center; gap:6px; font-size:0.85rem; color:var(--dc-dim); }
.dc-reco-done{ margin-left:auto; display:flex; align-items:center; gap:6px; font-size:0.85rem; font-weight:600; }
.dc-spin{ animation:dc-spin 1s linear infinite; }
@keyframes dc-spin{ to{ transform:rotate(360deg); } }

.dc-btn{ display:inline-flex; align-items:center; gap:6px; border-radius:8px; font-family:var(--dc-sans); font-weight:600; cursor:pointer; border:1px solid transparent; }
.dc-btn-sm{ padding:6px 12px; font-size:0.78rem; }
.dc-btn-primary{ background:var(--dc-ink); color:#fff; }
.dc-btn-ghost{ background:#fff; border-color:var(--dc-line); color:var(--dc-ink); }

.dc-pill{ display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; font-size:0.76rem; font-weight:700; border:1px solid; }
.dc-pill-ok{ color:var(--dc-ok); border-color:var(--dc-ok); background:#F0FAF4; }
.dc-pill-warn{ color:var(--dc-warn); border-color:var(--dc-warn); background:#FFF8EC; }
.dc-pill-danger{ color:var(--dc-danger); border-color:var(--dc-danger); background:#FDF0F1; }
.dc-pill-info{ color:var(--dc-info); border-color:var(--dc-info); background:#EEF3FE; }
.dc-pill-neutral{ color:var(--dc-dim); border-color:var(--dc-line); background:#fff; }

.dc-dot{ display:inline-block; width:9px; height:9px; border-radius:3px; margin-right:5px; vertical-align:-1px; }
.dc-legend-row{ display:flex; gap:14px; font-size:0.78rem; color:var(--dc-dim); margin-top:6px; }

/* landing bar */
.dc-landing-bar{ position:relative; height:26px; background:var(--dc-paper); border:1px solid var(--dc-line); border-radius:8px; overflow:hidden; }
.dc-landing-seg{ position:absolute; top:0; bottom:0; left:0; }
.dc-landing-secured{ background:var(--dc-ink); }
.dc-landing-pred{ background:repeating-linear-gradient(45deg, var(--dc-pred), var(--dc-pred) 5px, #E4D9F7 5px, #E4D9F7 10px); }
.dc-landing-target{ position:absolute; top:-3px; bottom:-3px; width:2.5px; background:var(--dc-danger); }
.dc-landing-legend{ display:flex; gap:16px; flex-wrap:wrap; font-size:0.78rem; color:var(--dc-dim); margin-top:10px; align-items:center; }
.dc-landing-ecart{ margin-left:auto; font-weight:700; }

/* comparison bars */
.dc-cbars{ display:grid; gap:10px; }
.dc-cbar-row{ }
.dc-cbar-label{ display:flex; justify-content:space-between; font-size:0.82rem; font-weight:600; margin-bottom:4px; }
.dc-cbar-track{ height:7px; background:var(--dc-paper); border-radius:4px; margin-bottom:3px; overflow:hidden; }
.dc-cbar-fill{ height:100%; border-radius:4px; }
.dc-cbar-declare{ background:var(--dc-ink); opacity:0.25; }
.dc-cbar-ia{ background:var(--dc-pred); opacity:0.85; }

/* ranklist */
.dc-ranklist{ list-style:none; margin:0; padding:0; display:grid; gap:10px; }
.dc-ranklist li{ display:flex; align-items:center; gap:10px; }
.dc-rank-n{ width:22px; height:22px; border-radius:6px; background:var(--dc-paper); border:1px solid var(--dc-line); display:flex; align-items:center; justify-content:center; font-family:var(--dc-mono); font-size:0.75rem; font-weight:700; flex-shrink:0; }
.dc-rank-name{ font-weight:700; flex:1; }
.dc-rank-who{ color:var(--dc-faint); font-size:0.8rem; }

/* toggles / simulation */
.dc-sim-toggles{ display:grid; gap:8px; margin:10px 0; }
.dc-toggle{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-radius:10px; border:1px solid var(--dc-line); background:#fff; font-family:var(--dc-sans); font-size:0.85rem; text-align:left; cursor:pointer; }
.dc-toggle-switch{ width:34px; height:19px; border-radius:999px; background:var(--dc-line); position:relative; flex-shrink:0; transition:background .15s; }
.dc-toggle-switch::after{ content:''; position:absolute; width:15px; height:15px; border-radius:50%; background:#fff; top:2px; left:2px; transition:transform .15s; box-shadow:0 1px 2px rgba(0,0,0,.3); }
.dc-toggle.is-on .dc-toggle-switch{ background:var(--dc-info); }
.dc-toggle.is-on .dc-toggle-switch::after{ transform:translateX(15px); }
.dc-sim-result{ display:flex; align-items:baseline; gap:10px; padding-top:10px; border-top:1px dashed var(--dc-line); font-size:0.85rem; color:var(--dc-dim); }

/* dormants */
.dc-dormants{ display:grid; gap:8px; }
.dc-dormant-row{ display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--dc-line); }
.dc-dormant-row:last-child{ border-bottom:none; }
.dc-dormant-client{ font-weight:700; flex:1; }
.dc-dormant-days{ display:flex; align-items:center; gap:4px; font-size:0.78rem; color:var(--dc-dim); }

/* email */
.dc-email{ background:var(--dc-paper); border:1px solid var(--dc-line); border-radius:10px; padding:12px 14px; font-size:0.85rem; }
.dc-email-line{ color:var(--dc-dim); margin-bottom:4px; }
.dc-email-body{ margin:8px 0 0; font-style:italic; color:var(--dc-ink); line-height:1.5; }

/* voice */
.dc-voice{ display:flex; align-items:center; gap:14px; }
.dc-voice-mic{ width:40px; height:40px; border-radius:50%; background:var(--dc-ink); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.dc-voice-wave{ display:flex; align-items:center; gap:2px; flex:1; height:32px; }
.dc-voice-wave span{ width:3px; background:var(--dc-line); border-radius:2px; }
.dc-voice-arrow{ color:var(--dc-faint); flex-shrink:0; }
.dc-voice-result{ flex:1.4; font-size:0.85rem; color:var(--dc-dim); }

/* feed */
.dc-feed{ display:grid; gap:12px; }
.dc-feed-item{ display:flex; gap:10px; font-size:0.85rem; line-height:1.5; }
.dc-feed-icon{ color:var(--dc-faint); flex-shrink:0; margin-top:2px; }
.dc-feed-meta{ display:block; color:var(--dc-faint); font-size:0.76rem; margin-top:2px; }

.dc-sources{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:12px; padding-top:10px; border-top:1px dashed var(--dc-line); }
.dc-sources-label{ font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--dc-faint); margin-right:2px; }
.dc-source-tag{ font-size:0.72rem; color:var(--dc-dim); background:var(--dc-paper); border:1px solid var(--dc-line); border-radius:999px; padding:2px 9px; }

/* contact map */
.dc-contact-map{ display:grid; gap:10px; }
.dc-contact{ display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; border:1px solid var(--dc-line); }
.dc-contact.ok{ border-left:3px solid var(--dc-ok); }
.dc-contact.warn{ border-left:3px solid var(--dc-warn); }
.dc-contact div{ flex:1; display:flex; flex-direction:column; }
.dc-contact span{ font-size:0.78rem; color:var(--dc-faint); }

/* timeline */
.dc-tl-axis{ display:flex; gap:10px; margin-bottom:6px; }
.dc-tl-axis span{ flex:1; font-size:0.72rem; color:var(--dc-faint); text-align:right; }
.dc-tl-axis span:first-child{ flex:0 0 120px; }
.dc-tl-row{ display:grid; grid-template-columns:120px 1fr auto; gap:10px; align-items:center; padding:5px 0; }
.dc-tl-name{ font-size:0.82rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dc-tl-bar{ position:relative; height:16px; background:var(--dc-paper); border-radius:5px; overflow:hidden; }
.dc-tl-seg{ position:absolute; top:0; bottom:0; }
.dc-tl-mission{ left:0; background:var(--dc-ink); opacity:0.8; }
.dc-tl-match{ background:repeating-linear-gradient(45deg, var(--dc-pred), var(--dc-pred) 4px, #E4D9F7 4px, #E4D9F7 8px); opacity:0.7; }
.dc-tl-gap{ background:repeating-linear-gradient(45deg, var(--dc-warn), var(--dc-warn) 4px, #F3E0C2 4px, #F3E0C2 8px); opacity:0.6; }
.dc-tl-tag{ font-size:0.72rem; color:var(--dc-dim); white-space:nowrap; }

/* xsell */
.dc-xsell{ display:grid; gap:10px; }
.dc-xsell-row{ display:flex; align-items:center; gap:10px; padding-bottom:8px; border-bottom:1px solid var(--dc-line); }
.dc-xsell-row:last-child{ border-bottom:none; padding-bottom:0; }
.dc-xsell-row div{ flex:1; display:flex; flex-direction:column; }
.dc-xsell-row span.dc-feed-meta{ margin-top:1px; }

/* trend bars */
.dc-tbars{ display:flex; align-items:flex-end; gap:16px; height:100px; }
.dc-tbar-col{ display:flex; flex-direction:column; align-items:center; gap:4px; justify-content:flex-end; height:100%; flex:1; }
.dc-tbar{ width:100%; max-width:36px; border-radius:5px; }
.dc-tbar-val{ font-family:var(--dc-mono); font-weight:700; font-size:0.8rem; }
.dc-tbar-label{ font-size:0.74rem; color:var(--dc-dim); }

/* coach */
.dc-coach{ display:grid; gap:12px; }
.dc-coach-row{ display:grid; grid-template-columns:70px 90px 1fr; gap:10px; align-items:center; }
.dc-coach-name{ font-weight:700; font-size:0.85rem; }
.dc-coach-bar{ height:7px; background:var(--dc-paper); border-radius:4px; overflow:hidden; }
.dc-coach-bar div{ height:100%; border-radius:4px; }
.dc-coach-tip{ font-size:0.8rem; color:var(--dc-dim); }

/* brief */
.dc-brief-head{ display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.dc-brief-line{ display:flex; gap:8px; font-size:0.88rem; color:var(--dc-dim); margin:6px 0; line-height:1.5; }

.dc-footer{ display:flex; flex-direction:column; align-items:center; gap:6px; justify-content:center; color:var(--dc-faint); font-size:0.8rem; padding:36px 0 10px; text-align:center; }
.dc-footer-line{ display:flex; align-items:center; gap:8px; }
.dc-footer-line-new{ color:#BE3455; font-weight:600; }

/* § « Le prochain palier » — 10 leviers proposés, pas encore actifs */
.dc-section-proposed{ border-top-style:dashed; }
.dc-subnav-item-new{ display:inline-flex; align-items:center; gap:5px; }
.dc-lever-tabs{ display:flex; gap:26px; flex-wrap:wrap; border-bottom:1px solid var(--dc-line); margin-bottom:18px; }
.dc-lever-tab{ display:flex; align-items:center; gap:7px; font-family:var(--dc-sans); font-size:0.92rem; font-weight:700; color:var(--dc-faint); background:none; border:none; border-bottom:2.5px solid transparent; margin-bottom:-1px; padding:4px 2px 12px; cursor:pointer; transition:color .15s, border-color .15s; }
.dc-lever-tab:hover{ color:var(--dc-dim); }
.dc-lever-tab.is-active{ color:var(--accent); border-bottom-color:var(--accent); }
.dc-lever-tab-count{ font-family:var(--dc-mono); font-size:0.68rem; font-weight:700; background:var(--dc-paper); border:1px solid var(--dc-line); border-radius:999px; padding:1px 7px; color:var(--dc-dim); }
.dc-lever-tab.is-active .dc-lever-tab-count{ color:var(--accent); border-color:var(--accent); background:transparent; }
.dc-lever-tagline-full{ font-size:0.85rem; font-weight:600; color:var(--accent); margin:0 0 14px; }
.dc-lever-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin-bottom:8px; }
.dc-lever{ border-top:3px dashed var(--accent); }
.dc-lever-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.dc-lever-tag{ font-family:var(--dc-mono); font-size:0.68rem; font-weight:700; color:var(--accent); border:1px solid var(--accent); padding:2px 8px; border-radius:999px; }
.dc-lever-status{ font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--dc-faint); }
.dc-lever-name{ font-weight:700; font-size:0.95rem; margin:0 0 10px; line-height:1.35; }
.dc-lever-row{ margin-bottom:8px; }
.dc-lever-row .dc-lever-k{ display:block; font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--dc-faint); margin-bottom:2px; }
.dc-lever-row p{ margin:0; font-size:0.83rem; color:var(--dc-dim); line-height:1.5; }
.dc-lever-value{ display:flex; align-items:center; gap:6px; font-weight:700; font-size:0.85rem; color:var(--accent); border-top:1px solid var(--dc-line); margin-top:10px; padding-top:10px; }

/* entrance */
.dc-fade{ animation:dc-fadeup .6s ease both; animation-delay:var(--d,0s); }
@keyframes dc-fadeup{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:translateY(0); } }
@media (prefers-reduced-motion: reduce){ .dc-fade{ animation:none; } .dc-spin{ animation:none; } }

/* responsive */
@media (max-width:980px){
  .dc-kpis{ grid-template-columns:repeat(2,1fr); }
  .dc-cols-3{ grid-template-columns:1fr 1fr; }
}
@media (max-width:680px){
  .dc-kpis{ grid-template-columns:1fr 1fr; }
  .dc-cols-2, .dc-cols-3{ grid-template-columns:1fr; }
  .dc-tl-row{ grid-template-columns:90px 1fr; }
  .dc-tl-tag{ grid-column:2; }
  .dc-coach-row{ grid-template-columns:1fr; gap:4px; }
}
`;
