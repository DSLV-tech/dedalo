import { memo } from 'react';
import styles from './Wordmark.module.css';

/**
 * Logotipo DEDALO disegnato su griglia di pixel 5×7.
 *
 * È vettoriale e nostro: nessun font da incorporare, nessuna licenza da
 * rispettare, e resta identico su qualsiasi dispositivo anche senza rete.
 * Ogni riga è una stringa di 0/1: modificare le lettere significa modificare
 * queste stringhe, non ridisegnare un tracciato.
 */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
};

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const TRACKING = 2;
/** Distacco fra i pixel: dà la trama a matrice invece di lettere piene. */
const GAP = 0.14;

interface Props {
  readonly text?: string;
  /** Altezza in em rispetto al contenitore. */
  readonly title?: string;
  readonly className?: string | undefined;
}

function WordmarkImpl({ text = 'DEDALO', title = 'DEDALO', className }: Props): JSX.Element {
  const letters = [...text.toUpperCase()].filter((char) => GLYPHS[char] !== undefined);
  const width = letters.length * GLYPH_WIDTH + Math.max(0, letters.length - 1) * TRACKING;

  return (
    <svg
      className={[styles.svg, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${width} ${GLYPH_HEIGHT}`}
      role="img"
      aria-label={title}
      preserveAspectRatio="xMidYMid meet"
    >
      <g fill="currentColor">
        {letters.map((char, index) => {
          const rows = GLYPHS[char];
          if (!rows) return null;
          const offsetX = index * (GLYPH_WIDTH + TRACKING);
          return (
            <g key={`${char}-${index}`}>
              {rows.map((row, y) =>
                [...row].map((cell, x) =>
                  cell === '1' ? (
                    <rect
                      key={`${x}-${y}`}
                      x={offsetX + x + GAP / 2}
                      y={y + GAP / 2}
                      width={1 - GAP}
                      height={1 - GAP}
                    />
                  ) : null,
                ),
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export const Wordmark = memo(WordmarkImpl);
