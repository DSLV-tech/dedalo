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

export default function App(): JSX.Element {
  const { state, record, helpOpen, dispatch, move, phaseDash, toggleHelp } = useGame();
  const { settings, setSettings, toggleMute, click } = useAudio(state);
  const [phaseArmed, setPhaseArmed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Su touch la transizione si "arma" prima di scegliere la direzione:
  // niente tasti modificatori disponibili.
  const handleTouchMove = useCallback(
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

  const swipe = state.phase === 'playing' ? handleTouchMove : undefined;

  return (
    <div className={styles.shell}>
      <Hud state={state} onHelp={toggleHelp} muted={settings.muted} onToggleMute={toggleMute} />

      <main className={styles.stage}>
        <GameCanvas state={state} onSwipe={swipe} />
        <aside className={panelOpen ? styles.sideOpen : styles.side}>
          <Minimap state={state} />
          <LogPanel log={state.log} />
        </aside>

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
      </main>

      <TouchControls
        onMove={handleTouchMove}
        onPhase={phaseDash}
        onWait={handleWait}
        onPulse={handlePulse}
        phaseArmed={phaseArmed}
        onTogglePhase={togglePhase}
        panelOpen={panelOpen}
        onTogglePanel={togglePanel}
      />

      <footer className={styles.footer}>
        <span>DEDALO · seed {state.seed}</span>
        <span>
          Sviluppo <a href="https://dslv.tech" target="_blank" rel="noreferrer">DSLV.tech</a>
        </span>
      </footer>
    </div>
  );
}
