import { useCallback, useEffect, useState } from 'react';
import { useGame } from './game/useGame';
import { useAudio } from './audio/useAudio';
import { GameCanvas } from './ui/GameCanvas';
import { Hud } from './ui/Hud';
import { LogPanel } from './ui/LogPanel';
import { Minimap } from './ui/Minimap';
import { TouchControls } from './ui/TouchControls';
import { EndOverlay, FinaleOverlay, HelpOverlay, TitleOverlay, UpgradeOverlay } from './ui/Overlays';
import type { Direction, EndingId, UpgradeId } from './engine/types';
import styles from './App.module.css';

/**
 * DEDALO è un gioco da telefono. Tutto vive dentro `.device`, un riquadro con
 * proporzioni da smartphone: sul telefono riempie lo schermo, su desktop diventa
 * una cornice centrata. Il layout interno reagisce alle dimensioni di quel
 * riquadro (container query), non a quelle della finestra — così la versione
 * incorniciata e quella reale si comportano in modo identico.
 */
export default function App(): JSX.Element {
  const { state, record, helpOpen, dispatch, move, phaseDash, toggleHelp } = useGame();
  const { settings, setSettings, toggleMute, click } = useAudio(state);
  const [phaseArmed, setPhaseArmed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Su touch la transizione si "arma" prima di scegliere la direzione:
  // niente tasti modificatori disponibili.
  const handleMove = useCallback(
    (dir: Direction) => {
      if (phaseArmed) {
        phaseDash(dir);
        setPhaseArmed(false);
      } else {
        move(dir);
      }
    },
    [move, phaseArmed, phaseDash],
  );

  const handleStart = useCallback(() => {
    click();
    dispatch({ type: 'start', seed: state.seed });
  }, [click, dispatch, state.seed]);
  const handleRestart = useCallback(() => {
    click();
    dispatch({ type: 'restart' });
  }, [click, dispatch]);
  const handleUpgrade = useCallback(
    (id: UpgradeId) => {
      click();
      dispatch({ type: 'chooseUpgrade', id });
    },
    [click, dispatch],
  );
  const handleEnding = useCallback(
    (id: EndingId) => {
      click();
      dispatch({ type: 'chooseEnding', id });
    },
    [click, dispatch],
  );
  const handleWait = useCallback(() => dispatch({ type: 'wait' }), [dispatch]);
  const handlePulse = useCallback(() => dispatch({ type: 'pulse' }), [dispatch]);
  const togglePhase = useCallback(() => setPhaseArmed((armed) => !armed), []);
  const togglePanel = useCallback(() => setPanelOpen((open) => !open), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'm' || event.key === 'M') toggleMute();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleMute]);

  // Chiude il pannello quando si apre una schermata a tutto campo.
  useEffect(() => {
    if (state.phase !== 'playing') setPanelOpen(false);
  }, [state.phase]);

  const playing = state.phase === 'playing';

  return (
    <div className={styles.page}>
      <div className={styles.device}>
        <div className={styles.shell}>
          {playing && (
            <Hud state={state} onHelp={toggleHelp} muted={settings.muted} onToggleMute={toggleMute} />
          )}

          <main className={styles.stage}>
            <GameCanvas state={state} onSwipe={playing ? handleMove : undefined} />
            {panelOpen && (
              <aside className={styles.sheet}>
                <Minimap state={state} />
                <LogPanel log={state.log} />
              </aside>
            )}
          </main>

          {playing && (
            <TouchControls
              onMove={handleMove}
              onWait={handleWait}
              onPulse={handlePulse}
              phaseArmed={phaseArmed}
              onTogglePhase={togglePhase}
              panelOpen={panelOpen}
              onTogglePanel={togglePanel}
              energy={state.energy}
            />
          )}

          {state.phase === 'title' && (
            <TitleOverlay seed={state.seed} record={record} onStart={handleStart} onHelp={toggleHelp} />
          )}
          {state.phase === 'upgrade' && (
            <UpgradeOverlay
              choices={state.upgradeChoices}
              depth={state.depth}
              records={state.records}
              onChoose={handleUpgrade}
            />
          )}
          {state.phase === 'finale' && <FinaleOverlay records={state.records} onChoose={handleEnding} />}
          {(state.phase === 'dead' || state.phase === 'won') && (
            <EndOverlay state={state} record={record} onRestart={handleRestart} />
          )}
          {helpOpen && <HelpOverlay onClose={toggleHelp} settings={settings} onSettings={setSettings} />}
        </div>
      </div>
    </div>
  );
}
