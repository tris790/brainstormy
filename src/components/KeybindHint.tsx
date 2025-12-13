import { type Keybind, getKeybindDisplay } from '../config/keybinds';

interface KeybindHintProps {
  keybind: Keybind;
  className?: string;
}

/**
 * Displays a keyboard shortcut hint
 * Always uses the centralized keybind configuration to ensure consistency
 */
export default function KeybindHint({ keybind, className = '' }: KeybindHintProps) {
  const defaultClass = 'px-1.5 py-0.5 bg-white/10 rounded text-white/50';
  const combinedClass = className || defaultClass;

  return <kbd className={combinedClass}>{getKeybindDisplay(keybind)}</kbd>;
}

interface KeybindHintWithLabelProps {
  keybind: Keybind;
  kbdClassName?: string;
  containerClassName?: string;
}

/**
 * Displays a keyboard shortcut hint with its description label
 * Used in settings panels and help sections
 */
export function KeybindHintWithLabel({
  keybind,
  kbdClassName,
  containerClassName = ''
}: KeybindHintWithLabelProps) {
  return (
    <div className={`flex justify-between ${containerClassName}`.trim()}>
      <span>{keybind.description}</span>
      <KeybindHint keybind={keybind} className={kbdClassName} />
    </div>
  );
}

interface KeybindHintInlineProps {
  keybind: Keybind;
  showLabel?: boolean;
  kbdClassName?: string;
}

/**
 * Displays a keyboard shortcut inline with text
 * Used in input hints and compact displays
 */
export function KeybindHintInline({
  keybind,
  showLabel = true,
  kbdClassName
}: KeybindHintInlineProps) {
  return (
    <span>
      <KeybindHint keybind={keybind} className={kbdClassName} />
      {showLabel && ` ${keybind.description}`}
    </span>
  );
}
