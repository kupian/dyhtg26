import { useMemo } from "react";
import type { LobbyProps } from "../types";
import { MORSE_MAP } from "../types";
import { sound } from "../sound";

export default function Lobby({
  onCreate,
  isLoading,
  errorMessage,
  onClearError,
  isMuted,
  onToggleMute,
  selectedIndex = 0,
  onSelectIndexChange,
  isJoining = false,
  onToggleJoining,
  joinCode = "",
  isJoinCodeInvalid = false,
  showRefModal = false,
  onToggleRefModal,
  showSettingsModal = false,
  onToggleSettingsModal,
  onTriggerMessageDelivery,
}: LobbyProps) {
  const MENU_OPTIONS = useMemo(
    () => [
      {
        id: "create",
        label: "CREATE GAME",
        action: () => {
          onTriggerMessageDelivery?.("CREATING ROOM...");
          void onCreate();
        },
      },
      {
        id: "join",
        label: "JOIN GAME",
        action: () => {
          onToggleJoining?.(true);
          onClearError?.();
          onTriggerMessageDelivery?.("ENTER 4 SIGNAL CODE TO JOIN");
        },
      },
      {
        id: "ref",
        label: "MORSE CHART",
        action: () => {
          onToggleRefModal?.(true);
          onTriggerMessageDelivery?.("MORSE ALPHABET CHART");
        },
      },
      {
        id: "settings",
        label: "SETTINGS",
        action: () => {
          onToggleSettingsModal?.(true);
          onTriggerMessageDelivery?.("SETTINGS & CONTROLS");
        },
      },
    ],
    [onCreate, onToggleJoining, onClearError, onToggleRefModal, onToggleSettingsModal, onTriggerMessageDelivery]
  );

  return (
    <div className="center-panel">
      {errorMessage && (
        <div className="error-banner">
          <span>{errorMessage}</span>
          <button type="button" onClick={onClearError} aria-label="Dismiss error">
            ✕
          </button>
        </div>
      )}

      <div className="menu-list">
        {MENU_OPTIONS.map((item, index) => {
          const isSelected = index === selectedIndex;

          if (item.id === "join" && isJoining) {
            return (
              <div
                key={item.id}
                className={`menu-item join-inline ${isJoinCodeInvalid ? "invalid" : ""}`}
                onClick={() => {
                  onSelectIndexChange?.(index);
                  sound.playMenu(isMuted ?? false);
                }}
              >
                <span>JOIN GAME &gt;</span>
                <span className="join-code-chars">{joinCode || "____"}</span>
                <span className="cursor" />
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className={`menu-item ${isSelected ? "selected" : ""}`}
              onClick={() => {
                onSelectIndexChange?.(index);
                sound.playMenu(isMuted ?? false);
                item.action();
              }}
            >
              <span className="arrow">&gt;</span>
              <span>
                {item.label}
                {isLoading && isSelected && item.id === "create" ? "..." : ""}
              </span>
            </div>
          );
        })}
      </div>

      {showRefModal && (
        <div className="modal-overlay" onClick={() => onToggleRefModal?.(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">MORSE CODE ALPHABET</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onToggleRefModal?.(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="reference-grid">
                {Object.entries(MORSE_MAP)
                  .filter(([k]) => k !== " ")
                  .map(([char, morse]) => (
                    <div key={char} className="ref-item">
                      <span className="ref-char">{char.toUpperCase()}</span>
                      <span className="ref-morse">{morse}</span>
                    </div>
                  ))}
              </div>
              <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                PRESS BOTH BUTTONS TWICE TO EXIT
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => onToggleSettingsModal?.(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">SETTINGS &amp; AUDIO</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onToggleSettingsModal?.(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="settings-group">
                <span className="settings-label">AUDIO SOUND</span>
                <div className="settings-row">
                  <span className="settings-name">AUDIO PREFERENCE</span>
                  <button
                    type="button"
                    className={`settings-toggle-btn ${isMuted ? "danger" : "primary"}`}
                    onClick={() => {
                      onToggleMute?.();
                      sound.playMenu(false);
                    }}
                  >
                    {isMuted ? "MUTED (OFF)" : "ACTIVE (ON)"}
                  </button>
                </div>
              </div>

              <div className="settings-group">
                <span className="settings-label">AUDIO TEST</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => sound.playDot(isMuted ?? false)}
                  >
                    TEST DOT (·)
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => sound.playDash(isMuted ?? false)}
                  >
                    TEST DASH (—)
                  </button>
                </div>
              </div>

              <div className="settings-group">
                <span className="settings-label">2-BUTTON CONTROLS SPECIFICATION</span>
                <div className="controls-card">
                  <div className="control-item">
                    <span>LEFT BUTTON [ . / Z ]:</span>
                    <span style={{ color: "var(--highlight)", fontWeight: "bold" }}>DOT / SELECT OPTION</span>
                  </div>
                  <div className="control-item">
                    <span>RIGHT BUTTON [ - / X ]:</span>
                    <span style={{ color: "var(--highlight)", fontWeight: "bold" }}>DASH / NEXT OPTION</span>
                  </div>
                  <div className="control-item" style={{ borderTop: "1px dashed var(--surface-border)", paddingTop: "0.4rem" }}>
                    <span>BOTH BUTTONS 1x (ONCE):</span>
                    <span style={{ color: "var(--highlight)", fontWeight: "bold" }}>ENTER / CONFIRM</span>
                  </div>
                  <div className="control-item">
                    <span>BOTH BUTTONS 2x (TWICE):</span>
                    <span style={{ color: "var(--highlight)", fontWeight: "bold" }}>BACK / CANCEL / LEAVE</span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                PRESS BOTH BUTTONS TWICE TO EXIT
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
