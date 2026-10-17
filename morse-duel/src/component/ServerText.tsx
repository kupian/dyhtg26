import React from 'react';
import { LetterMorsePair } from './LetterMorsePair';
import './ServerText.css'; // Assume this file exists or will be created

interface ServerTextProps {
  sentence: string;
  step: number;
  maxWidth?: number;
}

export const ServerText: React.FC<ServerTextProps> = ({ sentence, step, maxWidth = 300 }) => {
  const finalWidth = Math.min(window.innerWidth - 40, maxWidth);
  const letterWidth = 60;
  
  // Adjusted: Place arrow on the right. Content starts at left.
  const arrowWidth = 40;
  const contentWidth = finalWidth - arrowWidth;
  const maxScroll = Math.max(0, sentence.length * letterWidth + contentWidth);
  const scrollOffset = contentWidth - Math.min((step + 1) * letterWidth, maxScroll);


// const scrollOffset = contentWidth - Math.min(step * letterWidth, maxScroll);
  return (
    <div className="server-text-container" style={{ width: `${finalWidth}px` }}>
        <div className="server-text-overflow-container" style={{ width: `${contentWidth}px` }}>
            <div className="server-text-content" style={{ transform: `translateX(${scrollOffset}px)` }}>
                {sentence.split('').map((char, index) => (
                <div key={index} style={{ width: `${letterWidth}px`, opacity: index <= step ? 1 : 0.2 }}>
                    <LetterMorsePair letter={char} />
                </div>
                ))}
            </div>
        </div>
        <div className="arrow-right">🠈</div>
    </div>
  );
};
