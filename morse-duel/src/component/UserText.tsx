import React from 'react';
import './UserText.css';

interface UserTextProps {
  sentence: string;
  currentLetterIndex: number;
  currentInput: string;
}

export const UserText: React.FC<UserTextProps> = ({ sentence, currentLetterIndex, currentInput }) => {
  return (
    <div className="user-text-container">
      <div className="arrow-left">◀</div>
      <div className="user-text-content">
        {sentence.split('').map((char, index) => {
          const isCurrent = index === currentLetterIndex;
          return (
            <div key={index} className={`letter-container ${isCurrent ? 'current' : ''}`}>
              <span className="letter">{char}</span>
              {isCurrent && <span className="input-below">{currentInput}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
