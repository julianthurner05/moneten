// Stichwortliste: ordnet Gruppenausgaben anhand der Beschreibung automatisch
// einer Standard-Kategorie zu. Gilt für alle Anteile, egal wer eingetragen hat.
// Eine händische Zuordnung (personal_expense_categories) hat immer Vorrang.
//
// Regeln:
// - Alkohol in der Beschreibung → keine automatische Zuordnung (kann Einkaufen
//   oder Freizeit sein, das entscheidet die Person selbst).
// - Supermarkt/Drogerie erkannt → Einkaufen.
// - Sonst gewinnt das längste (spezifischste) Stichwort, bei Gleichstand die
//   Reihenfolge Einkaufen, Essen gehen, Freizeit.
// - Stichwörter bis 4 Zeichen und solche mit „=" davor zählen nur als ganzes
//   Wort, längere auch als Teil eines Worts („Bio-Vollmilch" trifft „milch").

/** Kleinbuchstaben, Umlaute ausgeschrieben, Satzzeichen zu Leerzeichen. */
export function normalizeText(text) {
  return ` ${String(text ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[éèê]/g, 'e')
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

const STORES = [
  // Supermärkte
  'billa', 'billa plus', 'billa corso', 'merkur', 'spar', 'eurospar', 'interspar', 'spar gourmet',
  'maximarkt', 'maxi markt', 'hofer', 'aldi', 'lidl', 'penny', 'mpreis', 'm preis', 'unimarkt',
  'nah und frisch', 'adeg', 'sutterluety', 'dennree', 'denns', 'basic bio', 'metro', 'transgourmet',
  'etsan', 'prosi', 'wiener feinkost', 'kastner', 'pfeiffer', 'nahversorger', 'supermarkt',
  'lebensmittelmarkt', 'diskonter', 'bauernmarkt', 'naschmarkt', 'brunnenmarkt', 'karmelitermarkt',
  'hofladen', 'ab hof', 'gurkerl', 'alfies', 'billa online', 'spar online', 'flink', 'gorillas',
  'mjam market', 'foodora market', 'wolt market', 'markthalle', 'asia shop', 'asiashop', 'asia markt',
  'tuerkischer markt', 'bio markt', 'biomarkt', 'reformhaus', 'gemuesehaendler', 'obststand',
  // Drogerien
  'dm', 'drogerie', 'drogeriemarkt', 'bipa', 'mueller drogerie', 'rossmann',
  // Bäckereien
  'baeckerei', 'baecker', 'stroeck', 'anker', 'felber', 'der mann', 'joseph brot', 'haubis',
  'kurt bauer', 'oeffner', 'gragger', 'geier',
];

// Eigenmarken, Produkte und Haushaltsbedarf – bewusst ohne Alkohol.
const EINKAUFEN = [
  // Allgemein
  'einkauf', 'einkaufen', 'wocheneinkauf', 'grosseinkauf', 'lebensmittel', 'groceries', 'jause',
  'vorrat', 'nachkauf', 'wg einkauf', 'kuehlschrank', 'pfand',
  // Eigenmarken
  'ja natuerlich', 'clever', 's budget', 'natur pur', 'zurueck zum ursprung', 'milfina', 'milsani',
  'spar premium', 'spar vital', 'billa bio', 'simply good', 'balea', 'bebe',
  // Gebäck und Brot
  'semmel', 'semmeln', 'kaisersemmel', 'kornspitz', 'weckerl', 'salzstangerl', 'gebaeck', 'brot',
  'toastbrot', 'toast', 'vollkornbrot', 'schwarzbrot', 'baguette', 'gipfel', 'kipferl', 'croissant',
  'striezel', 'brioche', 'wraps', 'tortilla', 'knaeckebrot', 'zwieback', 'brezel',
  // Milchprodukte und Eier
  'milch', 'vollmilch', 'hafermilch', 'sojamilch', 'mandelmilch', 'haferdrink', 'oatly', 'joghurt',
  'jogurt', 'skyr', 'topfen', 'schlagobers', 'obers', 'sauerrahm', 'creme fraiche', 'butter',
  'margarine', 'kaese', 'emmentaler', 'gouda', 'mozzarella', 'parmesan', 'feta', 'schafkaese',
  'frischkaese', 'philadelphia', 'bergkaese', 'raclette', 'eier', 'ei', 'buttermilch', 'kefir',
  'pudding', 'nöm', 'schaerdinger', 'berglandmilch', 'tirol milch', 'alpro',
  // Obst und Gemüse
  'obst', 'gemuese', 'salat', 'eisbergsalat', 'rucola', 'vogerlsalat', 'paradeiser', 'tomaten',
  'gurke', 'gurken', 'paprika', 'zwiebel', 'zwiebeln', 'knoblauch', 'erdaepfel', 'kartoffel',
  'kartoffeln', 'karotten', 'karfiol', 'brokkoli', 'broccoli', 'zucchini', 'melanzani', 'kohlsprossen',
  'fisolen', 'spinat', 'kraut', 'rotkraut', 'kohlrabi', 'lauch', 'porree', 'sellerie', 'kuerbis',
  'champignons', 'pilze', 'schwammerl', 'mais', 'avocado', 'ingwer', 'kraeuter', 'petersilie',
  'schnittlauch', 'basilikum', 'aepfel', 'apfel', 'birnen', 'bananen', 'banane', 'orangen', 'zitronen',
  'zitrone', 'limetten', 'mandarinen', 'trauben', 'weintrauben', 'marillen', 'zwetschken', 'pfirsich',
  'nektarinen', 'kirschen', 'erdbeeren', 'himbeeren', 'heidelbeeren', 'ribisel', 'beeren', 'melone',
  'wassermelone', 'ananas', 'mango', 'kiwi', 'radieschen', 'rote rueben', 'kichererbsen', 'linsen',
  'bohnen', 'erbsen',
  // Fleisch, Wurst, Fisch, Ersatz
  'fleisch', 'faschiertes', 'hendl', 'huhn', 'haehnchen', 'putenbrust', 'pute', 'rindfleisch',
  'schweinefleisch', 'schnitzelfleisch', 'wurst', 'extrawurst', 'leberkaese', 'schinken', 'speck',
  'salami', 'wuerstel', 'frankfurter', 'debreziner', 'kabanossi', 'aufschnitt', 'lachs', 'thunfisch',
  'fischstaebchen', 'garnelen', 'tofu', 'tempeh', 'seitan', 'veggie', 'vegan', 'like meat',
  'beyond meat', 'ruegenwalder', 'hummus', 'falafel mix', '=vegan',
  // Grundnahrungsmittel und Vorrat
  'nudeln', 'pasta', 'spaghetti', 'penne', 'fusilli', 'lasagneblaetter', 'reis', 'basmati', 'risotto',
  'couscous', 'bulgur', 'quinoa', 'mehl', 'zucker', 'staubzucker', 'germ', 'backpulver', 'vanillezucker',
  'salz', 'pfeffer', 'gewuerz', 'gewuerze', 'paprikapulver', 'curry', 'oel', 'olivenoel',
  'sonnenblumenoel', 'rapsoel', 'essig', 'balsamico', 'senf', 'ketchup', 'mayonnaise', 'mayo', 'kren',
  'sojasauce', 'pesto', 'passata', 'tomatenmark', 'dosentomaten', 'suppenwuerfel', 'gemuesesuppe',
  'bruehe', 'knorr', 'maggi', 'konserve', 'konserven', 'dose', 'dosen', 'muesli', 'haferflocken',
  'cornflakes', 'marmelade', 'konfituere', 'honig', 'nutella', 'erdnussbutter', 'aufstrich',
  'liptauer', 'tiefkuehl', 'tiefkuehlpizza', 'tk pizza', 'iglo', 'pommes', 'tiefkuehlgemuese',
  'fertiggericht', 'instant', 'nudelsuppe',
  // Süßes und Knabberzeug
  'schokolade', 'manner', 'mannerschnitten', 'milka', 'ritter sport', 'lindt', 'mozartkugeln',
  'kekse', 'keks', 'bensdorp', 'gummibaerchen', 'haribo', 'chips', 'kelly', 'soletti', 'snips',
  'erdnuesse', 'nuesse', 'studentenfutter', 'popcorn', 'knabberzeug', 'snacks', 'suessigkeiten',
  'eiscreme', 'speiseeis', 'eskimo', 'cremissimo',
  // Getränke ohne Alkohol
  'mineralwasser', 'mineral', '=wasser', 'soda', 'roemerquelle', 'voeslauer', 'gasteiner', 'juvina',
  'almdudler', 'saft', 'apfelsaft', 'orangensaft', 'rauch saft', 'pago', 'cappy', 'cola', 'coca cola',
  'pepsi', 'fanta', 'sprite', 'spezi', 'eistee', 'icetea', 'red bull', 'energy', 'sirup', 'holler',
  'kaffee', 'kaffeebohnen', 'kapseln', 'nespresso', 'tchibo', 'julius meinl', 'meinl', 'tee',
  'kakao', 'ovomaltine',
  // Haushalt und Putzen
  'haushalt', 'haushaltsbedarf', 'klopapier', 'toilettenpapier', 'wc papier', 'kuechenrolle',
  'kuechenpapier', 'taschentuecher', 'servietten', 'spuelmittel', 'geschirrspueler', 'spuelmaschine',
  'tabs', 'spueltabs', 'klarspueler', 'regeneriersalz', 'waschmittel', 'weichspueler', 'muellsaecke',
  'muellbeutel', 'alufolie', 'frischhaltefolie', 'backpapier', 'gefrierbeutel', 'schwamm', 'schwaemme',
  'putzmittel', 'reiniger', 'allzweckreiniger', 'badreiniger', 'wc reiniger', 'entkalker', 'essigreiniger',
  'glasreiniger', 'scheuermilch', 'putzlappen', 'mikrofasertuch', 'gummihandschuhe', 'kerzen',
  'teelichter', 'gluehbirne', 'batterien', 'feuerzeug', 'zuendhoelzer',
  // Hygiene und Drogerie
  'seife', 'fluessigseife', 'handseife', 'duschgel', 'shampoo', 'spuelung', 'zahnpasta', 'zahnbuerste',
  'zahnseide', 'deo', 'deodorant', 'rasierer', 'wattepads', 'wattestaebchen', 'binden', 'tampons',
  'hygieneartikel', 'sonnencreme', 'creme', 'bodylotion', 'pflaster',
];

const ESSEN_GEHEN = [
  'restaurant', 'gasthaus', 'gasthof', 'wirtshaus', 'beisl', 'beisel', 'heuriger', 'heurigen',
  'buschenschank', 'pizzeria', 'pizza', 'trattoria', 'osteria', 'kebab', 'kebap', 'doener', 'dueruem',
  'burger', 'mcdonalds', 'mcdonald', 'mcdo', 'burger king', 'five guys', 'subway', 'kfc', 'nordsee',
  'vapiano', 'le burger', 'swing kitchen', 'dean und david', 'sushi', 'ramen', 'pho', 'bao', 'dumplings',
  '=inder', 'indisch', 'thai', 'chinese', 'chinesisch', 'asiate', 'vietnamese', 'mexikaner', 'tacos',
  'burrito', 'mittagessen', 'abendessen', 'essen gehen', 'auswaerts', 'lieferando', 'mjam', 'foodora',
  'wolt', 'uber eats', 'takeaway', 'take away', 'essen bestellt', 'lieferservice',
  'wuerstelstand', 'bosna', 'kaesekrainer', 'brunch', 'fruehstueck', 'cafe', 'kaffeehaus',
  'konditorei', 'eissalon', 'tichy', 'zanoni', 'eisgreissler', 'mensa', 'kantine', 'imbiss', 'snackbar',
  'schnitzelhaus', 'figlmueller', 'trinkgeld',
];

const FREIZEIT = [
  'kino', 'kinokarte', 'kinokarten', 'kinoticket', 'cineplexx', 'village cinema', 'filmcasino', 'theater', 'oper', 'konzert', 'konzertkarte', 'konzertticket',
  'oeticket', 'festival', 'frequency', 'nova rock', 'donauinselfest', 'museum', 'ausstellung',
  'bowling', 'billard', 'minigolf', 'kletterhalle', 'klettern', 'boulder', 'bouldern', 'therme',
  'schwimmbad', 'freibad', 'hallenbad', 'sauna', 'eintritt', 'escape room', 'spieleabend', 'brettspiel',
  'gesellschaftsspiel', 'playstation', 'nintendo', 'steam', 'videospiel', 'netflix', 'spotify', 'disney',
  'ausflug', 'party', 'feier', 'geburtstag', 'disco', 'clubbing', 'skifahren', 'skipass', 'liftkarte',
  'rodeln', 'eislaufen', 'fitness', 'fitnessstudio', 'gym', 'fussball', 'padel', 'tennis', '=sport',
  'urlaub', '=reise', 'hotel', 'airbnb', 'camping', 'zelt', 'wandern', 'prater', 'zoo', 'schoenbrunn',
  'tiergarten', 'kartfahren', 'lasertag', 'karaoke', 'quiz', 'pub quiz', 'grillen', 'grillerei',
  'picknick',
];

// Alkohol: blockiert die automatische Zuordnung.
const ALCOHOL = [
  'bier', 'biere', 'dosenbier', 'radler', 'wein', 'rotwein', 'weisswein', 'rose', 'sekt', 'prosecco',
  'champagner', 'frizzante', 'spritzer', 'aperol', 'campari', 'schnaps', 'obstler', 'marille',
  'williams', 'vodka', 'wodka', 'gin', 'rum', 'whisky', 'whiskey', 'tequila', 'likoer', 'jaegermeister',
  'jaegi', 'pfeffi', 'baileys', 'cider', 'met', 'gluehwein', 'punsch', 'bowle', 'alkohol', 'spirituosen',
  'cocktail', 'cocktails', 'shots', 'stiegl', 'goesser', 'ottakringer', 'puntigamer', 'zipfer', 'murauer',
  'egger bier', 'schwechater', 'hirter', 'edelweiss', 'villacher', 'freistaedter', 'trumer', 'kaiser bier',
  'wieselburger', 'heineken', 'corona', 'budweiser', 'beck s', 'becks', 'krombacher', 'paulaner',
  'veltliner', 'gruener veltliner', 'zweigelt', 'blaufraenkisch', 'riesling', 'muskateller', 'sturm',
  'mojito', 'sangria', 'red bull vodka', 'wodka bull',
];

// Wörter, die zufällig auf „wein"/„bier" enden, aber kein Alkohol sind.
const ALCOHOL_SUFFIX_EXCEPTIONS = ['schwein', 'kabier'];

const prepare = (list) =>
  [...new Set(list)].map((raw) => {
    const exact = raw.startsWith('=');
    const key = normalizeText(exact ? raw.slice(1) : raw).trim();
    return { key, exact: exact || (!key.includes(' ') && key.length <= 4) };
  });

const STORE_KEYS = prepare(STORES);
const ALCOHOL_KEYS = prepare(ALCOHOL);
const CATEGORY_KEYS = [
  { name: 'Einkaufen', keys: prepare(EINKAUFEN) },
  { name: 'Essen gehen', keys: prepare(ESSEN_GEHEN) },
  { name: 'Freizeit', keys: prepare(FREIZEIT) },
];

/** Trifft das Stichwort den (normalisierten) Text? */
function hits(text, tokens, { key, exact }) {
  if (key.includes(' ')) return text.includes(` ${key} `);
  if (exact) return tokens.includes(key);
  return tokens.some((token) => token.includes(key));
}

function hasAlcohol(text, tokens) {
  if (ALCOHOL_KEYS.some((entry) => hits(text, tokens, entry))) return true;
  // Zusammengesetzte Wörter wie „Rotwein", „Dosenbier", „Glühwein".
  return tokens.some(
    (token) =>
      (token.endsWith('wein') || token.endsWith('bier')) &&
      token.length > 4 &&
      !ALCOHOL_SUFFIX_EXCEPTIONS.includes(token)
  );
}

/**
 * Kategorie-Name für eine Beschreibung oder null, wenn nichts eindeutig passt.
 * @param {string} description
 * @returns {'Einkaufen' | 'Essen gehen' | 'Freizeit' | null}
 */
export function autoCategoryName(description) {
  const text = normalizeText(description);
  const tokens = text.trim().split(' ').filter(Boolean);
  if (tokens.length === 0) return null;
  if (hasAlcohol(text, tokens)) return null;
  if (STORE_KEYS.some((entry) => hits(text, tokens, entry))) return 'Einkaufen';

  let best = null;
  let bestLength = 0;
  for (const category of CATEGORY_KEYS) {
    for (const entry of category.keys) {
      if (entry.key.length > bestLength && hits(text, tokens, entry)) {
        best = category.name;
        bestLength = entry.key.length;
      }
    }
  }
  return best;
}
