// Tests für die automatische Kategorie-Zuordnung über die Stichwortliste.
// Ausführen mit: npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import { autoCategoryName } from '../shared/keywords.js';
import { shareCategoryResolver } from '../shared/categories.js';

test('Supermärkte und Drogerien landen in Einkaufen', () => {
  for (const d of ['Billa', 'BILLA PLUS', 'Hofer Wocheneinkauf', 'Interspar', 'Nah&Frisch', 'MPreis', 'dm', 'Bipa', 'Penny Obst']) {
    assert.equal(autoCategoryName(d), 'Einkaufen', d);
  }
});

test('Produkte und Haushaltsbedarf landen in Einkaufen', () => {
  for (const d of ['Semmeln & Topfen', 'Klopapier', 'Bio-Vollmilch', 'Erdäpfel', 'Tiefkühlpizza', 'Spülmittel', 'Rinderfaschiertes']) {
    assert.equal(autoCategoryName(d), 'Einkaufen', d);
  }
});

test('Essen gehen und Freizeit werden erkannt', () => {
  assert.equal(autoCategoryName('Pizza'), 'Essen gehen');
  assert.equal(autoCategoryName('Mjam'), 'Essen gehen');
  assert.equal(autoCategoryName('Heuriger'), 'Essen gehen');
  assert.equal(autoCategoryName('Kinokarten'), 'Freizeit');
  assert.equal(autoCategoryName('Bowling'), 'Freizeit');
});

test('Alkohol wird nie automatisch zugeordnet, auch nicht beim Supermarkt', () => {
  for (const d of ['Spar Bier', 'Rotwein', 'Gösser Kiste', 'Glühwein', 'Billa Prosecco', 'Dosenbier']) {
    assert.equal(autoCategoryName(d), null, d);
  }
  assert.equal(autoCategoryName('Schweinefleisch'), 'Einkaufen');
  assert.equal(autoCategoryName('Weintrauben'), 'Einkaufen');
});

test('Wortteile führen nicht zu falschen Treffern', () => {
  for (const d of ['Miete', 'Kinder', 'Transport', 'Wasserrechnung', 'Klimaticket', 'Internet']) {
    assert.equal(autoCategoryName(d), null, d);
  }
});

test('Zuordnung: händisch vor Stichwort vor Sonstiges', () => {
  const resolve = shareCategoryResolver([
    { id: 'k1', name: 'Einkaufen', archived: 0 },
    { id: 'k2', name: 'Freizeit', archived: 0 },
    { id: 'k3', name: 'Sonstiges', archived: 0 },
  ]);
  assert.equal(resolve('k2', 'Billa'), 'k2');
  assert.equal(resolve(null, 'Billa'), 'k1');
  assert.equal(resolve(null, 'Miete'), 'k3');
  assert.equal(resolve(null, 'Spar Bier'), 'k3');
});
