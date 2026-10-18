import type { LobbyProps } from "../types";
import { MORSE_MAP } from "../types";
import { MENU_ITEMS, SETTINGS_ITEMS, SUBMENU_ITEMS, formatSeconds, formatVolume } from "../menu";
import { prettyMorse } from "../morse";

// Object key order puts "0"–"9" first; show A–Z, then digits.
const CHART_ENTRIES = Object.entries(MORSE_MAP).sort(
  ([a], [b]) => Number(/\d/.test(a)) - Number(/\d/.test(b)) || a.localeCompare(b)
);

export default function Lobby({
  menuIndex,
  isExpanded,
  subIndex,
  isJoining,
  joinCode,
  isJoinCodeInvalid,
  isLoading,
  errorMessage,
  onMenuItemClick,
  onSubItemClick,
  showChart,
  showSettings,
  settingsIndex,
  onSettingClick,
  isMuted,
  isMusicOn,
  musicVolumeTenths,
  letterHoldMs,
}: LobbyProps) {
  // Chart and settings replace the menu in place, so the pads stay usable.
  if (showChart) {
    return (
      <div className="center-panel">
        <h2 className="panel-title">MORSE LEARN</h2>
        <div className="reference-grid">
          {CHART_ENTRIES.map(([char, morse]) => (
            <div key={char} className="ref-item">
              <span className="ref-char">{char}</span>
              <span className="ref-morse">{prettyMorse(morse)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="center-panel">
        <h2 className="panel-title">SETTINGS</h2>
        <div className="menu-list">
          {SETTINGS_ITEMS.map((item, index) => (
            <div
              key={item.id}
              className={`menu-item ${index === settingsIndex ? "selected" : ""}`}
              onClick={() => onSettingClick(index)}
            >
              <span className="arrow">›</span>
              <span>{item.label}</span>
              {item.id === "sound" && (
                <span className={`setting-value ${isMuted ? "off" : "on"}`}>{isMuted ? "OFF" : "ON"}</span>
              )}
              {item.id === "music" && (
                <span className={`setting-value ${isMusicOn ? "on" : "off"}`}>{isMusicOn ? "ON" : "OFF"}</span>
              )}
              {item.id === "musicVolume" && <span className="setting-value">{formatVolume(musicVolumeTenths)}</span>}
              {item.id === "letterHold" && <span className="setting-value">{formatSeconds(letterHoldMs)}</span>}
            </div>
          ))}
        </div>

        <dl className="controls-list">
          <dt>Z · LEFT</dt>
          <dd>SELECT · DOT</dd>
          <dt>X · RIGHT</dt>
          <dd>NEXT · DASH</dd>
          <dt>HOLD STROKE</dt>
          <dd>END LETTER ({formatSeconds(letterHoldMs)})</dd>
          <dt>PAUSE 1s</dt>
          <dd>END LETTER</dd>
          <dt>BOTH</dt>
          <dd>BACK · SPACE</dd>
          <dt>HOLD BOTH</dt>
          <dd>LEAVE A GAME</dd>
        </dl>
      </div>
    );
  }

  return (
    <div className="center-panel">
      {errorMessage && (
        <p className="error-banner" role="alert">
          {errorMessage}
        </p>
      )}

      <nav className="menu-list">
        {MENU_ITEMS.map((item, index) => {
          const isHighlighted = index === menuIndex;
          const isOpen = isHighlighted && isExpanded;

          return (
            <div key={item.id} className="menu-group">
              <div
                className={`menu-item mode-${item.title} ${isHighlighted && !isExpanded ? "selected" : ""} ${isOpen ? "open" : ""}`}
                onClick={() => onMenuItemClick(index)}
              >
                <span className="arrow">›</span>
                <span>
                  {item.label}
                  {isOpen ? ":" : ""}
                </span>
              </div>

              {/* Python-style indented block under the open mode */}
              {isOpen && (
                <div className={`submenu mode-${item.mode}`}>
                  {SUBMENU_ITEMS.map((sub, j) => {
                    const isSubSelected = j === subIndex;

                    if (sub.id === "join" && isJoining) {
                      return (
                        <div
                          key={sub.id}
                          className={`menu-item join-inline selected ${isJoinCodeInvalid ? "invalid" : ""}`}
                        >
                          <span className="arrow">›</span>
                          <span>JOIN</span>
                          {/* No placeholder: the cursor sits right after what's been entered */}
                          <span className="join-code-chars">
                            {prettyMorse(joinCode)}
                            <span className="cursor" />
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={sub.id}
                        className={`menu-item ${isSubSelected ? "selected" : ""}`}
                        onClick={() => onSubItemClick(j)}
                      >
                        <span className="arrow">›</span>
                        <span>
                          {sub.label}
                          {isLoading && isSubSelected && sub.id === "create" ? "…" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
