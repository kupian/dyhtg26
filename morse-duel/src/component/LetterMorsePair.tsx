import React from 'react';
import { MORSE_MAP } from '../types';

interface LetterMorsePairProps {
  letter: string;
}

export const LetterMorsePair: React.FC<LetterMorsePairProps> = ({ letter }) => {
  const morse = MORSE_MAP[letter.toUpperCase()] || '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 4px' }}>
      <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.2rem' }}>{morse}</span>
      <span style={{ fontFamily: 'sans-serif', fontSize: '1rem' }}>{letter}</span>
    </div>
  );
};
