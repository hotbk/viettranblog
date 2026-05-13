import type { ICommand } from '@uiw/react-md-editor';

function alignCmd(align: 'left' | 'center' | 'right' | 'justify', icon: string, label: string): ICommand {
  return {
    name: `align-${align}`,
    keyCommand: `align-${align}`,
    buttonProps: { 'aria-label': label, title: label },
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        {align === 'left' && <>
          <rect x="0" y="1" width="12" height="1.5" rx="0.75"/>
          <rect x="0" y="4" width="8"  height="1.5" rx="0.75"/>
          <rect x="0" y="7" width="12" height="1.5" rx="0.75"/>
          <rect x="0" y="10" width="6" height="1.5" rx="0.75"/>
        </>}
        {align === 'center' && <>
          <rect x="0" y="1" width="12" height="1.5" rx="0.75"/>
          <rect x="2" y="4" width="8"  height="1.5" rx="0.75"/>
          <rect x="0" y="7" width="12" height="1.5" rx="0.75"/>
          <rect x="3" y="10" width="6" height="1.5" rx="0.75"/>
        </>}
        {align === 'right' && <>
          <rect x="0"  y="1"  width="12" height="1.5" rx="0.75"/>
          <rect x="4"  y="4"  width="8"  height="1.5" rx="0.75"/>
          <rect x="0"  y="7"  width="12" height="1.5" rx="0.75"/>
          <rect x="6"  y="10" width="6"  height="1.5" rx="0.75"/>
        </>}
        {align === 'justify' && <>
          <rect x="0" y="1"  width="12" height="1.5" rx="0.75"/>
          <rect x="0" y="4"  width="12" height="1.5" rx="0.75"/>
          <rect x="0" y="7"  width="12" height="1.5" rx="0.75"/>
          <rect x="0" y="10" width="12" height="1.5" rx="0.75"/>
        </>}
      </svg>
    ),
    execute(state, api) {
      const sel = state.selectedText;
      const content = sel || 'text';
      const replacement = `<div style="text-align:${align}">\n\n${content}\n\n</div>`;
      api.replaceSelection(replacement);
    },
  };
}

export const alignLeft    = alignCmd('left',    '⬜', 'Align left');
export const alignCenter  = alignCmd('center',  '⬛', 'Align center');
export const alignRight   = alignCmd('right',   '⬜', 'Align right');
export const alignJustify = alignCmd('justify', '⬛', 'Justify');

export const alignCommands = [alignLeft, alignCenter, alignRight, alignJustify];
