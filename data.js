/*
 * data.js — ÚNICA fonte da verdade musical do app.
 * Nenhum nome de nota ou valor de transposição pode ser escrito em outro arquivo.
 *
 * Cada linha descreve UMA nota que o saxofonista lê/toca e a nota que soa no piano:
 *  - indice:  classe de altura da nota do sax (0 = C ... 11 = B), serve de identidade da linha
 *  - pcPiano: classe de altura da nota do piano (0 = C ... 11 = B). É o que o autoteste confere.
 *  - saxNatural / pianoNatural: true se a nota daquele instrumento é natural (tecla branca)
 *  - sax / piano: nomes em letras e em solfejo. Quando há enarmonia, vêm os dois nomes.
 */
const TABELA = [
  { indice: 0,  pcPiano: 3,  saxNatural: true,  pianoNatural: false,
    sax:   { letras: ["C"],        solfejo: ["Dó"] },
    piano: { letras: ["Eb", "D#"], solfejo: ["Mib", "Ré#"] } },
  { indice: 1,  pcPiano: 4,  saxNatural: false, pianoNatural: true,
    sax:   { letras: ["C#", "Db"], solfejo: ["Dó#", "Réb"] },
    piano: { letras: ["E"],        solfejo: ["Mi"] } },
  { indice: 2,  pcPiano: 5,  saxNatural: true,  pianoNatural: true,
    sax:   { letras: ["D"],        solfejo: ["Ré"] },
    piano: { letras: ["F"],        solfejo: ["Fá"] } },
  { indice: 3,  pcPiano: 6,  saxNatural: false, pianoNatural: false,
    sax:   { letras: ["D#", "Eb"], solfejo: ["Ré#", "Mib"] },
    piano: { letras: ["F#", "Gb"], solfejo: ["Fá#", "Solb"] } },
  { indice: 4,  pcPiano: 7,  saxNatural: true,  pianoNatural: true,
    sax:   { letras: ["E"],        solfejo: ["Mi"] },
    piano: { letras: ["G"],        solfejo: ["Sol"] } },
  { indice: 5,  pcPiano: 8,  saxNatural: true,  pianoNatural: false,
    sax:   { letras: ["F"],        solfejo: ["Fá"] },
    piano: { letras: ["G#", "Ab"], solfejo: ["Sol#", "Láb"] } },
  { indice: 6,  pcPiano: 9,  saxNatural: false, pianoNatural: true,
    sax:   { letras: ["F#", "Gb"], solfejo: ["Fá#", "Solb"] },
    piano: { letras: ["A"],        solfejo: ["Lá"] } },
  { indice: 7,  pcPiano: 10, saxNatural: true,  pianoNatural: false,
    sax:   { letras: ["G"],        solfejo: ["Sol"] },
    piano: { letras: ["Bb", "A#"], solfejo: ["Sib", "Lá#"] } },
  { indice: 8,  pcPiano: 11, saxNatural: false, pianoNatural: true,
    sax:   { letras: ["G#", "Ab"], solfejo: ["Sol#", "Láb"] },
    piano: { letras: ["B"],        solfejo: ["Si"] } },
  { indice: 9,  pcPiano: 0,  saxNatural: true,  pianoNatural: true,
    sax:   { letras: ["A"],        solfejo: ["Lá"] },
    piano: { letras: ["C"],        solfejo: ["Dó"] } },
  { indice: 10, pcPiano: 1,  saxNatural: false, pianoNatural: false,
    sax:   { letras: ["A#", "Bb"], solfejo: ["Lá#", "Sib"] },
    piano: { letras: ["C#", "Db"], solfejo: ["Dó#", "Réb"] } },
  { indice: 11, pcPiano: 2,  saxNatural: true,  pianoNatural: true,
    sax:   { letras: ["B"],        solfejo: ["Si"] },
    piano: { letras: ["D"],        solfejo: ["Ré"] } },
];

/* Regra da transposição (usada pelo autoteste e pelo botão "Saiba mais"). */
const REGRA = {
  semitons: 3, // piano = sax + 3 semitons (módulo 12)
  textoSaibaMais:
    "A nota do piano é a nota do sax + 3 semitons (o mesmo que uma 6ª maior abaixo, ou 9 semitons abaixo). " +
    "Para voltar: nota do sax = nota do piano − 3 semitons.",
};
