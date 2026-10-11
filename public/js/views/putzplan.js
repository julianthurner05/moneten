// Putzplan der WG: Aufgaben rotieren wochenweise durch die Mitglieder.

import { api } from '../api.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { formatWeekRange, weekAdd, weekIndexOf, weekStartOf } from '../format.js';

export async function renderPutzplan(ctx, groupId) {
  const data = await api(`/api/groups/${groupId}/putzplan`);
  ctx.show('putzplan', () => build(ctx, groupId, data));
}

function build(ctx, groupId, data) {
  const { tasks, members, archived } = data;
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const thisWeek = weekStartOf();
  const nextWeek = weekAdd(thisWeek, 1);
  const doneSet = new Set(data.done.map((d) => `${d.taskId}|${d.weekStart}`));

  // Rotation: pro Woche rückt jede Aufgabe eine Person weiter.
  const assignee = (taskIndex, weekStart) =>
    members[(weekIndexOf(weekStart) + taskIndex) % members.length]?.id;

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

  const row = (task, taskIndex, weekStart, current) => {
    const done = doneSet.has(`${task.id}|${weekStart}`);
    const person = names.get(assignee(taskIndex, weekStart)) ?? '–';
    return el(
      'div',
      current && !archived
        ? {
            className: `row row-clickable einkauf-row${done ? ' is-done' : ''}`,
            onClick: async () => {
              await api(`/api/groups/${groupId}/putzplan/${task.id}`, {
                method: 'PUT',
                body: { weekStart, done: !done },
              });
              ctx.refresh();
            },
          }
        : { className: `row row-muted${done ? ' einkauf-row is-done' : ''}` },
      current ? el('span', { className: `einkauf-check${done ? ' is-done' : ''}`, 'aria-hidden': 'true' }, done ? '✓' : '') : null,
      el('div', { className: 'row-main' }, el('div', { className: 'row-title' }, task.name)),
      el(
        'div',
        { className: 'row-side' },
        el('div', { className: 'putzplan-person' }, person),
        current && !archived
          ? el(
              'button',
              {
                className: 'textlink',
                type: 'button',
                'aria-label': `${task.name} bearbeiten`,
                onClick: (event) => {
                  event.stopPropagation();
                  openTaskForm(ctx, groupId, task);
                },
              },
              'Bearbeiten'
            )
          : null
      )
    );
  };

  return el(
    'div',
    { className: 'view view-top' },
    archived ? null : addForm,
    tasks.length === 0
      ? el('p', { className: 'empty-note' }, 'Noch keine Aufgaben im Putzplan.')
      : [
          el('div', { className: 'section-label' }, `Diese Woche · ${formatWeekRange(thisWeek)}`),
          el('div', { className: 'row-list', 'data-stagger': '' }, tasks.map((t, i) => row(t, i, thisWeek, true))),
          el('div', { className: 'section-label' }, `Nächste Woche · ${formatWeekRange(nextWeek)}`),
          el('div', { className: 'row-list', 'data-stagger': '' }, tasks.map((t, i) => row(t, i, nextWeek, false))),
        ]
  );
}

function openTaskForm(ctx, groupId, task) {
  openPanel((close) => {
    const name = el('input', { id: 'putzplan-edit-name', type: 'text', required: true, value: task.name });
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

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          try {
            await api(`/api/groups/${groupId}/putzplan/${task.id}`, { method: 'PUT', body: { name: name.value } });
            close();
            ctx.refresh();
          } catch (err) {
            showError(err.message);
          }
        },
      },
      el('h2', { className: 'panel-title' }, 'Aufgabe bearbeiten'),
      el('div', { className: 'field' }, el('label', { className: 'field-label', for: 'putzplan-edit-name' }, 'Aufgabe'), name),
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
