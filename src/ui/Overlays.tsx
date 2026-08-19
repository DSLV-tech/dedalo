import { memo, useEffect, useState } from 'react';
import { MAX_DEPTH } from '../engine/content';
import {
  ENDINGS,
  FINALE,
  PROLOGUE,
  RECORDS_FOR_TRUE_ENDING,
  endingById,
  interludeFor,
} from '../engine/lore';
import { ACTOR_COLOR, ITEM_COLOR, PALETTE } from '../render/palette';
import type { EndingId, GameState, Upgrade, UpgradeId } from '../engine/types';
import type { RunRecord } from '../game/storage';
import type { AudioSettings } from '../audio/engine';
import { SettingsPanel } from './SettingsPanel';
import { TitleBackdrop } from './TitleBackdrop';
import styles from './Overlays.module.css';

interface TitleProps {
  readonly seed: number;
  readonly record: RunRecord;
  readonly onStart: () => void;
  readonly onHelp: () => void;
}

export const TitleOverlay = memo(function TitleOverlay({ seed, record, onStart, onHelp }: TitleProps): JSX.Element {
  return (
    <div className={styles.backdrop}>
      <TitleBackdrop />
      <div className={styles.panel}>
        <p className={styles.kicker}>{PROLOGUE.kicker}</p>
        <h1 className={styles.title}>{PROLOGUE.title}</h1>
        <p className={styles.lede}>{PROLOGUE.text}</p>
        <p className={styles.objective}>
          <span className={styles.objectiveLabel}>Obiettivo</span>
          {PROLOGUE.objective}
        </p>
        <div className={styles.meta}>
          <span>Seed <strong>{seed}</strong></span>
          <span>Record profondità <strong>{record.bestDepth || '—'}</strong></span>
          <span>Run giocate <strong>{record.runs}</strong></span>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.primary} onClick={onStart} autoFocus>
            Scendi nel Dedalo
          </button>
          <button type="button" className={styles.ghost} onClick={onHelp}>
            Comandi
          </button>
        </div>
        <p className={styles.footnote}>Invio per iniziare · ? per la leggenda</p>
      </div>
    </div>
  );
});

interface UpgradeProps {
  readonly choices: readonly Upgrade[];
  readonly depth: number;
  readonly records: number;
  readonly onChoose: (id: UpgradeId) => void;
}

export const UpgradeOverlay = memo(function UpgradeOverlay({ choices, depth, records, onChoose }: UpgradeProps): JSX.Element {
  const interlude = interludeFor(depth);
  return (
    <div className={styles.backdrop}>
      <div className={styles.panel}>
        {interlude && (
          <section className={styles.story}>
            <p className={styles.kicker}>
              Piano {depth} superato · {interlude.title}
            </p>
            <p className={styles.storyText}>{interlude.text}</p>
          </section>
        )}
        <h2 className={styles.titleSmall}>Installa un innesto</h2>
        <ul className={styles.cards}>
          {choices.map((upgrade, index) => (
            <li key={upgrade.id}>
              <button
                type="button"
                className={styles.card}
                onClick={() => onChoose(upgrade.id)}
                autoFocus={index === 0}
              >
                <span className={styles.cardName}>{upgrade.name}</span>
                <span className={styles.cardText}>{upgrade.description}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.footnote}>
          Registri recuperati: {records}/{RECORDS_FOR_TRUE_ENDING} necessari per restituire l’indice
        </p>
      </div>
    </div>
  );
});

interface FinaleProps {
  readonly records: number;
  readonly onChoose: (id: EndingId) => void;
}

export const FinaleOverlay = memo(function FinaleOverlay({ records, onChoose }: FinaleProps): JSX.Element {
  return (
    <div className={styles.backdrop}>
      <div className={styles.panel}>
        <p className={styles.kicker}>{FINALE.kicker}</p>
        <h2 className={styles.title}>{FINALE.title}</h2>
        <p className={styles.storyText}>{FINALE.text}</p>
        <ul className={styles.cards}>
          {ENDINGS.map((ending, index) => {
            const locked = records < ending.requiredRecords;
            return (
              <li key={ending.id}>
                <button
                  type="button"
                  className={locked ? styles.cardLocked : styles.card}
                  disabled={locked}
                  onClick={() => onChoose(ending.id)}
                  autoFocus={index === 0}
                >
                  <span className={styles.cardName}>{ending.choice}</span>
                  <span className={styles.cardText}>
                    {locked
                      ? `Bloccato — servono ${ending.requiredRecords} registri, ne hai ${records}.`
                      : ending.summary}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
});

interface EndProps {
  readonly state: GameState;
  readonly record: RunRecord;
  readonly onRestart: () => void;
}

export const EndOverlay = memo(function EndOverlay({ state, record, onRestart }: EndProps): JSX.Element {
  const ending = state.ending ? endingById(state.ending) : null;
  const won = state.phase === 'won';
  const [artOk, setArtOk] = useState(false);
  const artSrc = ending ? `${import.meta.env.BASE_URL}art/ending-${ending.id}.jpg` : null;

  useEffect(() => {
    if (!artSrc) return;
    // Illustrazione opzionale: se il file non c'è, la schermata resta com'è.
    const image = new Image();
    image.onload = () => setArtOk(true);
    image.src = artSrc;
  }, [artSrc]);

  return (
    <div className={styles.backdrop}>
      {artOk && artSrc && <img className={styles.endingArt} src={artSrc} alt="" />}
      <div className={styles.panel}>
        <p className={styles.kicker}>{won ? 'Epilogo' : 'Run terminata'}</p>
        <h2 className={won ? styles.titleGood : styles.titleBad}>
          {ending ? ending.title : 'INGHIOTTITO'}
        </h2>
        <p className={styles.storyText}>
          {ending
            ? ending.text
            : `Il Dedalo ti riscrive dentro di sé al piano ${state.depth}. L’archivio resta illeggibile, e adesso c’è una riga in più nel registro degli accessi.`}
        </p>
        <dl className={styles.score}>
          <div>
            <dt>Profondità</dt>
            <dd>{state.depth}/{MAX_DEPTH}</dd>
          </div>
          <div>
            <dt>Registri</dt>
            <dd>{state.records}</dd>
          </div>
          <div>
            <dt>Frammenti</dt>
            <dd>{state.shards}</dd>
          </div>
          <div>
            <dt>Turni</dt>
            <dd>{state.turn}</dd>
          </div>
        </dl>
        <p className={styles.footnote}>
          Record personale: profondità {record.bestDepth} · {record.bestShards} frammenti
        </p>
        <button type="button" className={styles.primary} onClick={onRestart} autoFocus>
          Nuova discesa
        </button>
      </div>
    </div>
  );
});

interface HelpProps {
  readonly onClose: () => void;
  readonly settings: AudioSettings;
  readonly onSettings: (patch: Partial<AudioSettings>) => void;
}

const LEGEND: ReadonlyArray<{ readonly color: string; readonly name: string; readonly text: string }> = [
  { color: ACTOR_COLOR.player, name: 'Tu', text: 'Unità di recupero. Muoverti addosso a un nemico è un attacco.' },
  { color: ACTOR_COLOR.sentinel, name: 'Sentinella', text: 'Lenta e resistente: si può seminare.' },
  { color: ACTOR_COLOR.stalker, name: 'Segugio', text: 'Si muove più veloce di te. Non fuggire in linea retta.' },
  { color: ACTOR_COLOR.node, name: 'Nodo', text: 'Immobile su un incrocio, colpisce duro da vicino.' },
  { color: ACTOR_COLOR.warden, name: 'Custode', text: 'Un archivista convertito. Serve energia per abbatterlo.' },
  { color: ACTOR_COLOR.anchor, name: 'Ancoraggio', text: 'Solo al piano 12: tre di questi rendono l’Architetto invulnerabile.' },
  { color: ACTOR_COLOR.architect, name: 'Architetto', text: 'Il processo che riscrive il Dedalo. Abbatti prima gli ancoraggi.' },
  { color: ITEM_COLOR.record, name: 'Registro', text: 'Nel caveau. Rivela la pianta e ricompone l’indice: servono per l’epilogo migliore.' },
  { color: ITEM_COLOR.shard, name: 'Frammento', text: 'Punteggio. Il campo attrattivo lo raccoglie a distanza.' },
  { color: ITEM_COLOR.cell, name: 'Cella', text: '+4 energia.' },
  { color: ITEM_COLOR.repair, name: 'Kit', text: '+6 integrità.' },
  { color: ITEM_COLOR.key, name: 'Chiave', text: 'Apre la porta arancione del caveau.' },
  { color: ITEM_COLOR.chip, name: 'Chip', text: 'Rivela la pianta del piano.' },
  { color: PALETTE.exit, name: 'Varco', text: 'Anello dorato: scende di un piano e offre un innesto. Al piano 12 è il Nucleo.' },
];

export const HelpOverlay = memo(function HelpOverlay({ onClose, settings, onSettings }: HelpProps): JSX.Element {
  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div className={styles.panelWide} onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Comandi e leggenda">
        <h2 className={styles.title}>Comandi</h2>
        <ul className={styles.keys}>
          <li><kbd>WASD</kbd> / <kbd>←↑↓→</kbd><span>Muoviti o attacca</span></li>
          <li><kbd>Shift</kbd>+direzione<span>Transizione: attraversi 2 celle, muri inclusi</span></li>
          <li><kbd>E</kbd><span>Impulso: danneggia tutto ciò che ti è adiacente</span></li>
          <li><kbd>Spazio</kbd><span>Attendi un turno</span></li>
          <li><kbd>?</kbd><span>Apri o chiudi questo pannello</span></li>
          <li><kbd>M</kbd><span>Silenzia o riattiva l’audio</span></li>
        </ul>
        <h3 className={styles.subtitle}>Su telefono</h3>
        <p className={styles.storyText}>
          Trascina sul labirinto per muoverti, oppure usa il D-pad. Il tasto Transizione si arma:
          premilo, poi scegli la direzione.
        </p>
        <h3 className={styles.subtitle}>Audio e feedback</h3>
        <SettingsPanel settings={settings} onChange={onSettings} />
        <h3 className={styles.subtitle}>Obiettivo</h3>
        <p className={styles.storyText}>{PROLOGUE.objective}</p>
        <h3 className={styles.subtitle}>Leggenda</h3>
        <ul className={styles.legend}>
          {LEGEND.map((entry) => (
            <li key={entry.name}>
              <span className={styles.dot} style={{ background: entry.color, boxShadow: `0 0 10px ${entry.color}` }} />
              <strong>{entry.name}</strong>
              <span>{entry.text}</span>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.ghost} onClick={onClose}>
          Chiudi
        </button>
      </div>
    </div>
  );
});
