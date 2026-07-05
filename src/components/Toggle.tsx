interface Props {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  icon?: string
}

// Skeuomorphic toggle switch with a satisfying flip.
export function Toggle({ on, onChange, label, icon }: Props) {
  return (
    <button
      className={`toggle ${on ? 'toggle-on' : ''}`}
      onClick={() => onChange(!on)}
      title={label}
      aria-pressed={on}
      aria-label={label}
    >
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">
        {icon && <span className="toggle-icon">{icon}</span>}
        {label}
      </span>
    </button>
  )
}
