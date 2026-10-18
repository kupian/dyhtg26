type PopupProps = {
  title: string;
  detail?: string;
  onDismiss: () => void;
};

/** A message over the current screen; any button (or a click) closes it. */
export default function Popup({ title, detail, onDismiss }: PopupProps) {
  return (
    <div className="popup-backdrop" onClick={onDismiss}>
      <div
        className="popup"
        role="alertdialog"
        aria-labelledby="popup-title"
        aria-describedby={detail ? "popup-detail" : undefined}
      >
        <h2 id="popup-title" className="popup-title">
          {title}
        </h2>
        {detail && (
          <p id="popup-detail" className="popup-detail">
            {detail}
          </p>
        )}
        <p className="popup-hint">PRESS ANY BUTTON</p>
      </div>
    </div>
  );
}
