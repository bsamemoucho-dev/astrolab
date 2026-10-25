import assert from 'node:assert/strict';
import test from 'node:test';
import { editorialStyleFindings } from '../src/deliverables/editorialStyle.mjs';

const codes = (text) => editorialStyleFindings(text).map((finding) => finding.code);

test('editorial style: dense repeated conditional is measured without judging the facts', () => {
  const text = 'Vous pourriez chercher une réponse. Cette réponse pourrait évoluer. Vous pourriez alors préciser une idée. Le symbole reste ouvert.';
  const finding = editorialStyleFindings(text).find((entry) => entry.code === 'editorial_mechanical_conditional');
  assert.deepEqual(finding.counts, { occurrences: 3, affectedSentences: 3, sentenceCount: 4, sentenceShare: 0.75 });
  assert.match(finding.message, /sans attribuer un trait certain/);
});

test('editorial style: one legitimate conditional or a short text is not a tic', () => {
  for (const text of ['', null, 'Vous pourriez choisir une autre formulation.', 'Le symbole pourrait éclairer un contraste, sans décrire votre histoire.', 'Vous pourriez comparer ces deux possibilités. Cette démarche pourrait rester ouverte.']) {
    assert.deepEqual(editorialStyleFindings(text), [], String(text));
  }
});

test('editorial style: occasional conditional in a varied passage remains acceptable', () => {
  const text = 'Vous pourriez examiner cette piste. Le lien met deux fonctions en regard. Le premier registre porte la direction. Le second concerne la valeur. Une nuance pourrait compter. Le choix appartient au lecteur. Le rapprochement reste symbolique. Une autre lecture demeure ouverte. Vous pourriez préférer celle-ci.';
  assert.ok(!codes(text).includes('editorial_mechanical_conditional'));
});

test('editorial style: a stock paragraph opening must recur at least three times', () => {
  const text = 'Cette dynamique peut poser un contraste.\n\nCette dynamique peut aussi déplacer une question.\n\nCette dynamique peut rester ouverte.';
  const finding = editorialStyleFindings(text).find((entry) => entry.code === 'editorial_repeated_paragraph_opening');
  assert.deepEqual(finding.counts, { repeatedParagraphs: 3, paragraphCount: 3, sharedPrefixWords: 3 });
  assert.ok(!codes('Cette dynamique peut rester ouverte.\n\nCette dynamique peut changer de portée.').includes('editorial_repeated_paragraph_opening'));
});

test('editorial style: repeated factual labels or ordinary subjects do not imply generic prose', () => {
  const text = 'La Lune forme un carré avec Mercure.\n\nLa Lune forme un trigone avec Jupiter.\n\nLa Lune forme un sextile avec Vénus.';
  assert.deepEqual(editorialStyleFindings(text), []);
  assert.deepEqual(editorialStyleFindings('Le temps, la patience et l’équilibre sont trois mots du passage. Leur présence ne constitue pas un conseil.'), []);
});

test('editorial style: two distinct explicit interchangeable suggestions are reported', () => {
  const finding = editorialStyleFindings('Prenez du recul. Trouvez votre équilibre.').find((entry) => entry.code === 'editorial_generic_advice_accumulation');
  assert.deepEqual(finding.counts, { distinctAdvicePatterns: 2, adviceOccurrences: 2 });
});

test('editorial style: advice can be explicit under a possibility marker', () => {
  assert.ok(codes('Vous pourriez prendre du recul et avancer à votre rythme.').includes('editorial_generic_advice_accumulation'));
  assert.ok(codes('Vous pouvez faire confiance à votre intuition. Pensez à accueillir vos émotions.').includes('editorial_generic_advice_accumulation'));
});

test('editorial style: one advice pattern or ordinary technical instructions are not accumulation', () => {
  assert.deepEqual(editorialStyleFindings('Prenez du recul.'), []);
  assert.deepEqual(editorialStyleFindings('Vous pouvez vérifier la date locale. Comparez ensuite les deux valeurs calculées.'), []);
  assert.deepEqual(editorialStyleFindings('Prendre du recul et avancer à votre rythme figurent dans le lexique étudié.'), []);
});

test('editorial style: apostrophe and whitespace variants keep the same measurements', () => {
  const text = 'Restez à l’écoute de vous-même. Faites preuve de patience.';
  assert.ok(codes(text).includes('editorial_generic_advice_accumulation'));
  assert.deepEqual(editorialStyleFindings(text), editorialStyleFindings(text.replaceAll('’', "'").replaceAll(' ', '\u00a0')));
});

test('editorial style: findings contain fixed guidance and numbers, never copied private prose', () => {
  const text = 'Vous pourriez penser à PRIVATE_PERSON et private@example.invalid. Cette personne pourrait répondre. Vous pourriez choisir une autre lecture.';
  const result = editorialStyleFindings(text);
  assert.ok(result.length > 0);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /PRIVATE_PERSON|private@example|cette personne/i);
  for (const finding of result) {
    assert.deepEqual(Object.keys(finding).sort(), ['code', 'counts', 'message']);
    assert.ok(Object.values(finding.counts).every((value) => typeof value === 'number'));
    assert.equal('severity' in finding, false);
  }
});

test('editorial style: diagnostics never change or truncate the supplied text', () => {
  const text = 'Vous pourriez lire ceci. Vous pourriez lire cela. La lecture pourrait continuer.\n\nPrenez du recul. Trouvez votre équilibre.';
  const original = text;
  assert.ok(editorialStyleFindings(text).length >= 2);
  assert.equal(text, original);
});
