import React from 'react';
import { LetterMorsePair } from './LetterMorsePair';
import './ServerText.css'; // Assume this file exists or will be created

interface ServerTextProps {
  sentence: string;
  step: number;
}

export const ServerText: React.FC<ServerTextProps> = ({ sentence, step }) => {
  const visibleText = sentence.slice(0, step);

  return (
    <div className="server-text-container">
      <div className="server-text-content">
        {visibleText.split('').map((char, index) => (
          <LetterMorsePair key={index} letter={char} />
        ))}
      </div>
      <div className="arrow-right">➤</div>
    </div>
  );
};
