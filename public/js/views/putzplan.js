// Putzplan der WG: zeigt nur die eigene fällige Aufgabe, groß als antippbare
// Karte (tippen = erledigt). Aufgaben und Rhythmus verwaltet der Admin.

import { api } from '../api.js';
import { createSelect } from '../controls.js';
import { confirmPanel, el, openPanel } from '../dom.js';

// Rhythmus als Paar „Wochenabstand/Durchgänge pro Woche".
const RHYTHM_OPTIONS = [
  { value: '1/3', label: '3x die Woche' },
  { value: '1/2', label: '2x die Woche' },
  { value: '1/1', label: 'Jede Woche' },
  { value: '2/1', label: 'Alle 2 Wochen' },
  { value: '3/1', label: 'Alle 3 Wochen' },
  { value: '4/1', label: 'Alle 4 Wochen' },
];

function rhythmValue(task) {
  return `${task?.intervalWeeks ?? 1}/${task?.timesPerWeek ?? 1}`;
}

function rhythmLabel(task) {
  return RHYTHM_OPTIONS.find((o) => o.value === rhythmValue(task))?.label ?? `Alle ${task.intervalWeeks} Wochen`;
}

export async function renderPutzplan(ctx, groupId) {
  const data = await api(`/api/groups/${groupId}/putzplan`);
  ctx.setCleaningCount(groupId, data.myOpenCount);
  ctx.show('putzplan', () => build(ctx, groupId, data));
}

function build(ctx, groupId, data) {
  const { archived, weekStart } = data;
  const isAdmin = ctx.state.user.isAdmin;

  const toggleDone = async (item) => {
    await api(`/api/groups/${groupId}/putzplan/${item.taskId}`, {
      method: 'PUT',
      body: { weekStart, slot: item.slot, done: !item.done },
    });
    ctx.refresh();
  };

  // Eigene fällige Aufgabe als große, antippbare Karte.
  const mineCard = (item) =>
    el(
      'button',
      {
        className: `card putzplan-card${item.done ? ' is-done' : ''}`,
        type: 'button',
        disabled: archived,
        onClick: () => toggleDone(item),
      },
      el('div', { className: 'card-amount card-amount-small' }, item.name),
      el(
        'div',
        { className: 'card-foot putzplan-card-foot' },
        item.done
          ? [el('span', { className: 'einkauf-check is-done', 'aria-hidden': 'true' }, '✓'), 'Erledigt – tippen macht es rückgängig']
          : el('span', { className: 'button putzplan-done-button' }, 'Erledigt')
      )
    );

  const mineArea =
    data.mine.length === 0
      ? el('p', { className: 'empty-note' }, 'Diese Woche bist du mit nichts dran.')
      : el('div', { className: 'putzplan-mine', 'data-stagger': '' }, data.mine.map(mineCard));

  // Verwaltung nur für den Admin: Aufgaben samt Rhythmus anlegen und bearbeiten.
  const taskRows = data.tasks.map((task) =>
    el(
      'button',
      {
        className: 'row row-clickable',
        type: 'button',
        disabled: archived,
        onClick: () => openTaskForm(ctx, groupId, task),
      },
      el(
        'div',
        { className: 'row-main' },
        el('div', { className: 'row-label' }, rhythmLabel(task)),
        el('div', { className: 'row-title' }, task.name)
      ),
      el('div', { className: 'row-side' }, el('span', { className: 'textlink' }, 'Bearbeiten'))
    )
  );

  const adminArea = !isAdmin
    ? null
    : [
        el(
          'div',
          { className: 'settings-block-head' },
          el('div', { className: 'section-label' }, 'Aufgaben'),
          archived
            ? null
            : el('button', { className: 'textlink', type: 'button', onClick: () => openTaskForm(ctx, groupId, null) }, '+ Aufgabe'),
        ),
        data.tasks.length === 0
          ? el('p', { className: 'empty-note' }, 'Noch keine Aufgaben im Putzplan.')
          : el('div', { className: 'row-list', 'data-stagger': '' }, taskRows),
      ];

  return el('div', { className: 'view view-top' }, mineArea, adminArea);
}

function openTaskForm(ctx, groupId, task) {
  openPanel((close) => {
    const isEdit = !!task;
    const name = el('input', { id: 'putzplan-edit-name', type: 'text', required: true, value: task?.name ?? '' });
    const rhythm = createSelect({
      id: 'putzplan-edit-rhythm',
      options: RHYTHM_OPTIONS,
      value: rhythmValue(task),
    });
    const error = el('p', { className: 'form-error', role: 'alert' });
    const showError = (message) => {
      error.textContent = message;
      error.classList.add('is-visible');
    };

    const remove = async () => {
      const ok = await confirmPanel('Diese Aufgabe wirklich löschen?', 'Löschen');
      if (!ok) return;
      try {
        await api(`/api/groups/${groupId}/putzplan/${task.id}`, { method: 'DELETE' });
        close();
        ctx.refresh();
      } catch (err) {
        showError(err.message);
      }
    };

    const wrap = (label, field, forId) =>
      el('div', { className: 'field' }, el('label', { className: 'field-label', for: forId }, label), field);

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          const [intervalWeeks, timesPerWeek] = rhythm.value.split('/').map(Number);
          const body = { name: name.value, intervalWeeks, timesPerWeek };
          try {
            if (isEdit) {
              await api(`/api/groups/${groupId}/putzplan/${task.id}`, { method: 'PUT', body });
            } else {
              await api(`/api/groups/${groupId}/putzplan`, { method: 'POST', body });
            }
            close();
            ctx.refresh();
          } catch (err) {
            showError(err.message);
          }
        },
      },
      el('h2', { className: 'panel-title' }, isEdit ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'),
      wrap('Aufgabe', name, 'putzplan-edit-name'),
      wrap('Rhythmus', rhythm.root, 'putzplan-edit-rhythm'),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        isEdit ? el('button', { className: 'textlink textlink-danger', type: 'button', onClick: remove }, 'Löschen') : null,
        el('div', { className: 'toolbar-spacer' }),
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Speichern')
      )
    );
  });
}
