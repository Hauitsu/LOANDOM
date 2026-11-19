/* Icon-and-name class picker used by the character settings modal.
   Native radios provide arrow-key navigation and a single tab stop; the text
   field remains the source of truth so arbitrary custom classes still work. */

import { attr, esc } from './util.js';
import { CLASS_GROUPS, classInfo } from './classes.js';
import { classBadge } from './classbadge.js';

const groupId = (index) => `class-picker-group-${index + 1}`;

export function classPicker(value) {
  const current = classInfo(value);
  const selected = current?.name || '';
  const groups = CLASS_GROUPS.map((group, index) => `
    <section class="class-group" aria-labelledby="${groupId(index)}">
      <span class="class-group-label" id="${groupId(index)}">${esc(group.name)}</span>
      <div class="class-group-grid">
        ${group.entries.map((entry) => {
          const checked = entry.name === selected;
          return `<label class="class-choice${checked ? ' is-selected' : ''}" title="${attr(entry.name)}">
            <input type="radio" name="classChoice" value="${attr(entry.name)}"${checked ? ' checked' : ''} />
            <span class="class-choice-icon" aria-hidden="true">${classBadge(entry.name, 20)}</span>
            <span class="class-choice-name">${esc(entry.name)}</span>
          </label>`;
        }).join('')}
      </div>
    </section>`).join('');

  return `<fieldset class="field span2 class-picker" data-class-picker>
    <legend>Class</legend>
    <p class="class-picker-note" id="class-picker-note">Choose a class to use its bundled emblem, or type a custom class below.</p>
    <div class="class-picker-groups">${groups}</div>
    <label class="class-custom">
      <span>Custom class</span>
      <input name="className" value="${attr(value)}" placeholder="e.g. Gunslinger" maxlength="24" autocomplete="off" aria-describedby="class-picker-note" />
    </label>
    <p class="tiny-note">Custom text is kept as entered and uses the fallback crest.</p>
  </fieldset>`;
}

/** Wire selection feedback after the modal markup has been inserted. */
export function wireClassPicker(container) {
  const picker = container.querySelector('[data-class-picker]');
  if (!picker) return;
  const input = picker.querySelector('input[name="className"]');
  const radios = Array.from(picker.querySelectorAll('input[name="classChoice"]'));
  if (!input || !radios.length) return;

  const paint = () => {
    const info = classInfo(input.value);
    radios.forEach((radio) => {
      const on = Boolean(info && radio.value === info.name);
      radio.checked = on;
      radio.closest('.class-choice')?.classList.toggle('is-selected', on);
    });
  };

  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      input.value = radio.value;
      paint();
    });
  });
  input.addEventListener('input', paint);
  paint();

  // Keep the saved choice visible when reopening a character whose class sits
  // below the picker's internal scroll fold.
  const groups = picker.querySelector('.class-picker-groups');
  const card = picker.querySelector('.class-choice.is-selected');
  if (groups && card) {
    const box = groups.getBoundingClientRect();
    const chip = card.getBoundingClientRect();
    if (chip.top < box.top || chip.bottom > box.bottom) {
      const section = card.closest('.class-group') || card;
      groups.scrollTop += section.getBoundingClientRect().top - box.top - 4;
    }
  }
}
