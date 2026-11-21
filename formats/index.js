/**
 * FORMAT-REGISTRY
 *
 * Jedes Format des Abends steht hier mit id, Name und Farbe.
 * - Gibt es einen Ordner `formats/<id>/` mit `server.js` und `client.js`,
 *   ist das Format spielbar.
 * - Ohne Ordner erscheint das Format nur als (nicht anwählbarer) Eintrag
 *   in der Kapitelleiste.
 *
 * Die Reihenfolge am Abend steht in `config.json` (formatOrder).
 * Formate, die dort fehlen, werden hinten angehängt.
 *
 * Farben: bitte aus der Testbild-Palette wählen
 *   #C9C6BD  #D8C12F  #3DB2BE  #44A35A  #B0479B  #C9362E  #2C4BA8
 */
export default [
  { id: 'kategorien', name: 'Kategorien', color: '#D8C12F' },
  { id: 'quiz', name: 'Klassisches Quiz', color: '#3DB2BE' },
  { id: 'laender', name: 'Länderraten', color: '#44A35A' },
  { id: 'wavelength', name: 'Wavelength', color: '#B0479B' },
  { id: 'bluff', name: 'Bluff', color: '#2C4BA8' },
  { id: 'familyfeud', name: 'Family Feud', color: '#C9362E' },
];
