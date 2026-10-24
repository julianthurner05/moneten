// Putzplan der WG: zeigt nur die eigenen Aufgaben. Die fällige Aufgabe steht
// groß als Karte und wird durch Antippen erledigt; darunter die nächsten
// eigenen Runden und die Verwaltung aller Aufgaben.

import { api } from '../api.js';
import { createSelect } from '../controls.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { formatWeekRange } from '../format.js';

const RHYTHM_OPTIONS = [
  { value: '1', label: 'Jede Woche' },
  { value: '2', label: 'Alle 2 Wochen' },
  { value: '3', label: 'Alle 3 Wochen' },
  { value: '4', label: 'Alle 4 Wochen' },
];

function rhythmLabel(intervalWeeks) {
  return RHYTHM_OPTIONS.find((o) => o.value === String(intervalWeeks))?.label ?? `Alle ${intervalWeeks} Wochen`;
}

export async function renderPutzplan(ctx, groupId) {
  const data = await api(`/api/groups/${groupId}/putzplan`);
  ctx.setCleaningCount(groupId, data.myOpenCount);
  ctx.show('putzplan', () => build(ctx, groupId, data));
}

function build(ctx, groupId, data) {
  const { archived, weekStart } = data;

  const toggleDone = async (taskId, done) => {
    await api(`/api/groups/${groupId}/putzplan/${taskId}`, { method: 'PUT', body: { weekStart, done } });
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
        onClick: () => toggleDone(item.taskId, !item.done),
      },
      el(
        'div',
        { className: 'card-meta' },
        el('span', {}, 'Diese Woche'),
        el('span', {}, formatWeekRange(weekStart))
      ),
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

  // Nächste eigene Runden, ausgegraut.
  const upcomingRows = data.upcoming.map((item) =>
    el(
      'div',
      { className: 'row row-muted' },
      el('div', { className: 'row-main' }, el('div', { className: 'row-title' }, item.name)),
      el('div', { className: 'row-side' }, el('div', { className: 'putzplan-person' }, formatWeekRange(item.weekStart)))
    )
  );

  // Verwaltung: Aufgabe ergänzen, Rhythmus und Name bearbeiten.
  const input = el('input', {
    id: 'putzplan-input',
    type: 'text',
    placeholder: 'Aufgabe hinzufügen',
    autocomplete: 'off',
  });
  const addForm = el(
    'form',
    {
      className: 'einkauf-add',
      onSubmit: async (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        await api(`/api/groups/${groupId}/putzplan`, { method: 'POST', body: { name } });
        ctx.refresh();
      },
    },
    el('div', { className: 'field' }, input)
  );

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
        el('div', { className: 'row-label' }, rhythmLabel(task.intervalWeeks)),
        el('div', { className: 'row-title' }, task.name)
      ),
      el('div', { className: 'row-side' }, el('span', { className: 'textlink' }, 'Bearbeiten'))
    )
  );

  return el(
    'div',
    { className: 'view view-top' },
    el('div', { className: 'section-label' }, `Diese Woche · ${formatWeekRange(weekStart)}`),
    mineArea,
    upcomingRows.length > 0
      ? [
          el('div', { className: 'section-label' }, 'Demnächst'),
          el('div', { className: 'row-list', 'data-stagger': '' }, upcomingRows),
        ]
      : null,
    el('div', { className: 'section-label' }, 'Aufgaben'),
    archived ? null : addForm,
    data.tasks.length === 0
      ? el('p', { className: 'empty-note' }, 'Noch keine Aufgaben im Putzplan.')
      : el('div', { className: 'row-list', 'data-stagger': '' }, taskRows)
  );
}

function openTaskForm(ctx, groupId, task) {
  openPanel((close) => {
    const name = el('input', { id: 'putzplan-edit-name', type: 'text', required: true, value: task.name });
    const rhythm = createSelect({
      id: 'putzplan-edit-rhythm',
      options: RHYTHM_OPTIONS,
      value: String(task.intervalWeeks ?? 1),
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
          try {
            await api(`/api/groups/${groupId}/putzplan/${task.id}`, {
              method: 'PUT',
              body: { name: name.value, intervalWeeks: Number(rhythm.value) },
            });
            close();
            ctx.refresh();
          } catch (err) {
            showError(err.message);
          }
        },
      },
      el('h2', { className: 'panel-title' }, 'Aufgabe bearbeiten'),
      wrap('Aufgabe', name, 'putzplan-edit-name'),
      wrap('Rhythmus', rhythm.root, 'putzplan-edit-rhythm'),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink textlink-danger', type: 'button', onClick: remove }, 'Löschen'),
        el('div', { className: 'toolbar-spacer' }),
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Speichern')
      )
    );
  });
}
