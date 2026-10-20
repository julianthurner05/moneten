// Eigenen Anteil an einer Gruppenausgabe einer Kategorie zuordnen.

import { api } from '../api.js';
import { createSelect } from '../controls.js';
import { el, openPanel } from '../dom.js';

export function openShareCategoryForm(ctx, categories, share) {
  openPanel((close) => {
    const category = createSelect({
      id: 'share-category',
      options: [
        { value: '', label: 'Automatisch' },
        ...categories
          .filter((c) => !c.archived || c.id === share.assignedCategoryId)
          .map((c) => ({ value: c.id, label: c.name })),
      ],
      value: share.assignedCategoryId ?? '',
    });
    const error = el('p', { className: 'form-error', role: 'alert' });

    const submit = async (event) => {
      event.preventDefault();
      try {
        await api(`/api/personal/shares/${share.expenseId}`, {
          method: 'PUT',
          body: { categoryId: category.value || null },
        });
        close();
        ctx.refresh();
      } catch (err) {
        error.textContent = err.message;
        error.classList.add('is-visible');
      }
    };

    return el(
      'form',
      { onSubmit: submit },
      el('h2', { className: 'panel-title' }, share.description),
      el(
        'div',
        { className: 'field' },
        el('label', { className: 'field-label', for: 'share-category' }, 'Kategorie'),
        category.root
      ),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        el('div', { className: 'toolbar-spacer' }),
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Speichern')
      )
    );
  });
}
