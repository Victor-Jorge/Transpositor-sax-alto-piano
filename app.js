"use strict";
/*
 * app.js — lógica do app. Nenhum valor musical aparece aqui:
 * nomes, índices e a regra vêm de data.js (TABELA e REGRA).
 */

/* ===================== CONFIGURAÇÕES ===================== */
const CHAVES = {                       // chaves do Local Storage
  historico: "saxTransp.historico",
  nomenclatura: "saxTransp.nomenclatura",
  nivel: "saxTransp.nivel",
};
const NIVEIS = {                       // para criar um nível novo, basta acrescentar aqui
  facil:    { rotulo: "Fácil",    apenasNaturais: true,  descricao: "Perguntas só com notas naturais (sem sustenidos nem bemóis)." },
  avancado: { rotulo: "Avançado", apenasNaturais: false, descricao: "Todas as notas, incluindo sustenidos e bemóis." },
};
const NOMENCLATURAS = {                // chaves iguais às de data.js (letras / solfejo)
  letras:  { rotulo: "Cifra (letras)" },
  solfejo: { rotulo: "Solfejo" },
};
const DIRECOES = {                     // as duas perguntas possíveis, misturadas no sorteio
  sax2piano: { origem: "sax",   destino: "piano" },
  piano2sax: { origem: "piano", destino: "sax" },
};
const INSTRUMENTOS = {                 // texto usado nos enunciados
  sax:   { longo: "sax alto", curto: "Sax" },
  piano: { longo: "piano",    curto: "Piano" },
};
const SORTEIO = { pesoBase: 1, pesoErro: 4, taxaErroSemDados: 0.5 };
const ATRASO_AVANCO_MS = 900;          // pausa depois de um acerto

/* ===================== ESTADO ===================== */
const estado = {
  nivel: "facil",
  nomenclatura: "letras",
  historico: {},          // { "indice:direcao": { acertos, erros } }
  placar: { acertos: 0, erros: 0 },
  pergunta: null,         // { linha, direcao }
  respondida: false,
  ultimaChave: null,      // evita repetir a mesma pergunta em seguida
  timer: null,
};

const $ = (id) => document.getElementById(id);
function criar(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/* ===================== LOCAL STORAGE (à prova de falhas) ===================== */
// Se o navegador bloquear o storage, guardamos na memória e avisamos o usuário.
const memoriaReserva = {};

function lerArmazenado(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto === null ? (chave in memoriaReserva ? memoriaReserva[chave] : padrao) : JSON.parse(bruto);
  } catch (e) {
    $("aviso").hidden = false;
    return chave in memoriaReserva ? memoriaReserva[chave] : padrao;
  }
}

function gravarArmazenado(chave, valor) {
  memoriaReserva[chave] = valor;
  try { localStorage.setItem(chave, JSON.stringify(valor)); }
  catch (e) { $("aviso").hidden = false; }
}

// Lê o histórico e descarta qualquer coisa fora do formato esperado (dados corrompidos).
function carregarHistorico() {
  const bruto = lerArmazenado(CHAVES.historico, {});
  const limpo = {};
  if (bruto && typeof bruto === "object") {
    for (const [k, v] of Object.entries(bruto)) {
      if (v && Number.isFinite(v.acertos) && Number.isFinite(v.erros)) limpo[k] = { acertos: v.acertos, erros: v.erros };
    }
  }
  return limpo;
}

/* ===================== ACESSO À TABELA ===================== */
const pcDaNota = (linha, instr) => (instr === "sax" ? linha.indice : linha.pcPiano);
const notaEhNatural = (linha, instr) => linha[instr + "Natural"];
const linhaPorPcPiano = (pc) => TABELA.find((l) => l.pcPiano === pc);
const nomesDaNota = (linha, instr) => linha[instr][estado.nomenclatura].join(" / ");
const nomeCurto = (linha, instr) => linha[instr][estado.nomenclatura][0];
const chaveHistorico = (linha, direcaoId) => linha.indice + ":" + direcaoId;
const textoCorrespondencia = (linha) =>
  INSTRUMENTOS.sax.curto + " " + nomesDaNota(linha, "sax") + " → " + INSTRUMENTOS.piano.curto + " " + nomesDaNota(linha, "piano");

/* ===================== SORTEIO ===================== */
// Todas as perguntas permitidas no nível atual (a nota-pergunta precisa respeitar o filtro do nível).
function listarPerguntasPossiveis() {
  const nivel = NIVEIS[estado.nivel];
  const lista = [];
  for (const direcaoId of Object.keys(DIRECOES)) {
    for (const linha of TABELA) {
      if (!nivel.apenasNaturais || notaEhNatural(linha, DIRECOES[direcaoId].origem)) lista.push({ linha, direcao: direcaoId });
    }
  }
  return lista;
}

// Quanto maior a taxa de erro, maior o peso. Sem dados daquela pergunta, usa uma taxa média.
function pesoDaPergunta(p) {
  const h = estado.historico[chaveHistorico(p.linha, p.direcao)];
  const total = h ? h.acertos + h.erros : 0;
  const taxa = total ? h.erros / total : SORTEIO.taxaErroSemDados;
  return SORTEIO.pesoBase + SORTEIO.pesoErro * taxa;
}

function sortearPergunta() {
  let pool = listarPerguntasPossiveis();
  if (pool.length > 1) pool = pool.filter((p) => chaveHistorico(p.linha, p.direcao) !== estado.ultimaChave);
  const temHistorico = Object.keys(estado.historico).length > 0;
  const pesos = pool.map((p) => (temHistorico ? pesoDaPergunta(p) : 1)); // sem histórico: uniforme
  let sorte = Math.random() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    sorte -= pesos[i];
    if (sorte <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/* ===================== QUIZ ===================== */
function validarResposta(pergunta, pcEscolhido) {
  // Compara a CLASSE DE ALTURA (0–11), então C# e Db contam como a mesma resposta.
  return pcEscolhido === pcDaNota(pergunta.linha, DIRECOES[pergunta.direcao].destino);
}

function registrarResultado(pergunta, acertou) {
  const chave = chaveHistorico(pergunta.linha, pergunta.direcao);
  const h = estado.historico[chave] || { acertos: 0, erros: 0 };
  if (acertou) h.acertos++; else h.erros++;
  estado.historico[chave] = h;
  estado.placar[acertou ? "acertos" : "erros"]++;
  gravarArmazenado(CHAVES.historico, estado.historico);
}

function atualizarPlacar() {
  $("placar-acertos").textContent = estado.placar.acertos;
  $("placar-erros").textContent = estado.placar.erros;
}

function novaPergunta() {
  clearTimeout(estado.timer);
  estado.pergunta = sortearPergunta();
  estado.ultimaChave = chaveHistorico(estado.pergunta.linha, estado.pergunta.direcao);
  estado.respondida = false;
  $("feedback").hidden = true;
  renderizarPergunta();
}

function renderizarPergunta() {
  if (!estado.pergunta) return;
  const { linha, direcao } = estado.pergunta;
  const { origem, destino } = DIRECOES[direcao];
  const chip = $("pergunta-chip");
  chip.className = "chip chip--" + origem;
  chip.textContent = "Nota no " + INSTRUMENTOS[origem].longo;
  $("pergunta-nota").className = "pergunta__nota pergunta__nota--" + origem;
  $("pergunta-nota").textContent = nomesDaNota(linha, origem);
  $("pergunta-texto").textContent = "Qual é a nota no " + INSTRUMENTOS[destino].longo + "?";
  $("pergunta").setAttribute("aria-label",
    "Nota no " + INSTRUMENTOS[origem].longo + ": " + nomesDaNota(linha, origem) + ". Qual é a nota no " + INSTRUMENTOS[destino].longo + "?");
  if (!estado.respondida) renderizarRespostas();
}

// Um botão por classe de altura do instrumento de destino, em ordem de altura.
function renderizarRespostas() {
  const destino = DIRECOES[estado.pergunta.direcao].destino;
  const caixa = $("respostas");
  caixa.replaceChildren();
  const linhas = TABELA.slice().sort((a, b) => pcDaNota(a, destino) - pcDaNota(b, destino));
  for (const linha of linhas) {
    const b = criar("button", "resposta", nomesDaNota(linha, destino));
    b.type = "button";
    b.dataset.pc = pcDaNota(linha, destino);
    b.setAttribute("aria-label", "Responder " + nomesDaNota(linha, destino));
    b.addEventListener("click", () => responder(Number(b.dataset.pc)));
    caixa.append(b);
  }
}

function responder(pcEscolhido) {
  if (estado.respondida) return;
  estado.respondida = true;
  const p = estado.pergunta;
  const acertou = validarResposta(p, pcEscolhido);
  registrarResultado(p, acertou);
  atualizarPlacar();

  const pcCerto = pcDaNota(p.linha, DIRECOES[p.direcao].destino);
  for (const b of $("respostas").children) {
    b.disabled = true;
    if (Number(b.dataset.pc) === pcCerto) b.classList.add("resposta--certa");
    else if (Number(b.dataset.pc) === pcEscolhido) b.classList.add("resposta--errada");
  }
  if (acertou) mostrarFeedbackAcerto(p.linha); else mostrarFeedbackErro(p.linha);
}

function mostrarFeedbackAcerto(linha) {
  const f = $("feedback");
  f.className = "feedback feedback--ok";
  f.replaceChildren(criar("p", "", "Correto! " + textoCorrespondencia(linha)));
  f.hidden = false;
  estado.timer = setTimeout(novaPergunta, ATRASO_AVANCO_MS);
}

function mostrarFeedbackErro(linha) {
  const f = $("feedback");
  f.className = "feedback feedback--erro";
  f.replaceChildren(
    criar("p", "feedback__titulo", "Não foi dessa vez."),
    criar("p", "feedback__correspondencia", textoCorrespondencia(linha)),
    desenharPiano(linha),
    criarLegenda()
  );

  // A regra só aparece se o usuário pedir (estimula decorar em vez de calcular).
  const regra = criar("p", "saiba-mais", REGRA.textoSaibaMais);
  regra.hidden = true;
  const btnRegra = criar("button", "botao", "Saiba mais");
  btnRegra.type = "button";
  btnRegra.setAttribute("aria-expanded", "false");
  btnRegra.addEventListener("click", () => {
    regra.hidden = !regra.hidden;
    btnRegra.setAttribute("aria-expanded", String(!regra.hidden));
  });
  const btnProxima = criar("button", "botao botao--principal", "Próxima pergunta");
  btnProxima.type = "button";
  btnProxima.addEventListener("click", novaPergunta);

  const acoes = criar("div", "acoes");
  acoes.append(btnRegra, btnProxima);
  f.append(acoes, regra);
  f.hidden = false;
  btnProxima.focus();
}

/* ===================== TECLADO DE PIANO ===================== */
// Desenha uma oitava. Teclas brancas/pretas e nomes vêm da TABELA (pianoNatural, pcPiano).
function desenharPiano(linha) {
  const pcSax = pcDaNota(linha, "sax");
  const pcPiano = pcDaNota(linha, "piano");
  const totalBrancas = TABELA.filter((l) => l.pianoNatural).length;
  const piano = criar("div", "piano");
  piano.setAttribute("role", "img");
  piano.setAttribute("aria-label", textoCorrespondencia(linha));

  let brancasAntes = 0;
  const larguraPreta = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--larg-preta")) || 9;
  for (let pc = 0; pc < TABELA.length; pc++) {
    const info = linhaPorPcPiano(pc);
    const tecla = criar("div", "tecla " + (info.pianoNatural ? "tecla--branca" : "tecla--preta"));
    if (info.pianoNatural) brancasAntes++;
    else tecla.style.left = (brancasAntes / totalBrancas) * 100 - larguraPreta / 2 + "%";

    if (pc === pcSax) { tecla.classList.add("tecla--sax"); tecla.textContent = nomeCurto(linha, "sax"); }
    if (pc === pcPiano) { tecla.classList.add("tecla--piano"); tecla.textContent = nomeCurto(linha, "piano"); }
    piano.append(tecla);
  }
  return piano;
}

function criarLegenda() {
  const l = criar("div", "legenda");
  const a = criar("span"); const ia = criar("i"); ia.style.background = "var(--sax)";
  a.append(ia, "Sax lê");
  const b = criar("span"); const ib = criar("i"); ib.style.background = "var(--piano)";
  b.append(ib, "Piano soa");
  l.append(a, b);
  return l;
}

/* ===================== TABELA E HISTÓRICO ===================== */
function renderizarTabela() {
  const t = $("tabela-completa");
  t.replaceChildren();
  const cab = criar("tr");
  cab.append(criar("th", "col-sax", "Sax (lê)"), criar("th", "col-piano", "Piano (soa)"));
  t.append(cab);
  for (const linha of TABELA) {
    const tr = criar("tr");
    tr.append(criar("td", "col-sax", nomesDaNota(linha, "sax")), criar("td", "col-piano", nomesDaNota(linha, "piano")));
    t.append(tr);
  }
}

function renderizarHistorico() {
  const raiz = $("historico-conteudo");
  raiz.replaceChildren();
  for (const [direcaoId, { origem, destino }] of Object.entries(DIRECOES)) {
    raiz.append(criar("h4", "", "Pergunta: nota do " + INSTRUMENTOS[origem].longo + " → resposta no " + INSTRUMENTOS[destino].longo));
    const t = criar("table");
    const cab = criar("tr");
    cab.append(criar("th", "col-" + origem, "Nota"), criar("th", "", "Acertos"), criar("th", "", "Erros"));
    t.append(cab);
    const linhas = TABELA.slice().sort((a, b) => pcDaNota(a, origem) - pcDaNota(b, origem));
    for (const linha of linhas) {
      const h = estado.historico[chaveHistorico(linha, direcaoId)] || { acertos: 0, erros: 0 };
      const tr = criar("tr");
      tr.append(criar("td", "col-" + origem, nomesDaNota(linha, origem)), criar("td", "num", h.acertos), criar("td", "num", h.erros));
      t.append(tr);
    }
    const rolagem = criar("div", "rolagem-tabela");
    rolagem.append(t);
    raiz.append(rolagem);
  }
}

function limparHistorico() {
  if (!window.confirm("Apagar todo o histórico de acertos e erros? Isso não pode ser desfeito.")) return;
  estado.historico = {};
  estado.placar = { acertos: 0, erros: 0 };
  gravarArmazenado(CHAVES.historico, {});
  atualizarPlacar();
  renderizarHistorico();
}

/* ===================== INTERFACE (abas e opções) ===================== */
// Cria uma lista de cartões de opção (usada na tela de Ajustes).
// "descrever(valor)" devolve o texto de apoio de cada opção.
function criarSegmentos(idCaixa, opcoes, valorAtual, aoEscolher, descrever) {
  const caixa = $(idCaixa);
  caixa.replaceChildren();
  for (const [valor, config] of Object.entries(opcoes)) {
    const b = criar("button", "opcao");
    b.type = "button";
    b.setAttribute("aria-pressed", String(valor === valorAtual));
    b.append(criar("span", "opcao__titulo", config.rotulo), criar("span", "opcao__desc", descrever(valor)));
    b.addEventListener("click", () => aoEscolher(valor));
    caixa.append(b);
  }
}

// Exemplo tirado da TABELA, para o usuário ver como as notas vão aparecer.
function exemploNomenclatura(chave) {
  const nomes = TABELA.filter((l) => l.saxNatural).slice(0, 4).map((l) => l.sax[chave][0]);
  return "Ex.: " + nomes.join(", ") + "…";
}

function mostrarTela(nome) {
  for (const id of ["quiz", "tabela", "historico", "ajustes"]) $("tela-" + id).hidden = id !== nome;
  for (const b of document.querySelectorAll(".abas button")) {
    if (b.dataset.tela === nome) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  }
  if (nome === "historico") renderizarHistorico();
}

function escolherNomenclatura(valor) {
  estado.nomenclatura = valor;
  gravarArmazenado(CHAVES.nomenclatura, valor);
  montarOpcoes();
  renderizarTabela();
  renderizarHistorico();
  // Redesenha a pergunta e (se já respondida) mantém o feedback coerente com a nova grafia.
  if (estado.pergunta) {
    renderizarPergunta();
    if (estado.respondida) {
      const pcCerto = pcDaNota(estado.pergunta.linha, DIRECOES[estado.pergunta.direcao].destino);
      renderizarRespostas();
      for (const b of $("respostas").children) { b.disabled = true; if (Number(b.dataset.pc) === pcCerto) b.classList.add("resposta--certa"); }
      if (!$("feedback").classList.contains("feedback--ok")) mostrarFeedbackErro(estado.pergunta.linha);
    }
  }
}

function escolherNivel(valor) {
  estado.nivel = valor;
  gravarArmazenado(CHAVES.nivel, valor);
  montarOpcoes();
  novaPergunta();
}

function montarOpcoes() {
  criarSegmentos("seg-nivel", NIVEIS, estado.nivel, escolherNivel, (v) => NIVEIS[v].descricao);
  criarSegmentos("seg-nomenclatura", NOMENCLATURAS, estado.nomenclatura, escolherNomenclatura, exemploNomenclatura);
  // Atalho no quiz: mostra o ajuste atual e leva à tela de Ajustes.
  $("nivel-atual").textContent = NIVEIS[estado.nivel].rotulo + " · " + NOMENCLATURAS[estado.nomenclatura].rotulo;
}

/* ===================== AUTOTESTE (rode autoteste() no console) ===================== */
function autoteste() {
  const falhas = [];
  const mod12 = (n) => ((n % 12) + 12) % 12;
  if (TABELA.length !== 12) falhas.push("A tabela deveria ter 12 linhas e tem " + TABELA.length);
  if (new Set(TABELA.map((l) => l.indice)).size !== TABELA.length) falhas.push("Há índices de sax duplicados");
  if (new Set(TABELA.map((l) => l.pcPiano)).size !== TABELA.length) falhas.push("Há índices de piano duplicados");

  for (const l of TABELA) {
    if (mod12(l.pcPiano - l.indice) !== mod12(REGRA.semitons)) falhas.push("Linha " + l.indice + ": piano − sax ≠ +" + REGRA.semitons);
    // ida e volta: sax → piano → sax precisa devolver a nota original
    const linhaDoPiano = linhaPorPcPiano(l.pcPiano);
    const volta = linhaDoPiano ? mod12(l.pcPiano - REGRA.semitons) : null;
    if (volta !== l.indice) falhas.push("Linha " + l.indice + ": ida e volta não retorna à nota original");
    for (const instr of ["sax", "piano"]) {
      for (const tipo of Object.keys(NOMENCLATURAS)) {
        if (!Array.isArray(l[instr][tipo]) || l[instr][tipo].length === 0) falhas.push("Linha " + l.indice + ": faltam nomes (" + instr + "/" + tipo + ")");
      }
    }
  }
  if (falhas.length) console.error("Autoteste FALHOU:\n- " + falhas.join("\n- "));
  else console.log("Autoteste OK: 12 linhas, sem duplicados, piano = sax + " + REGRA.semitons + " e ida/volta corretas.");
  return falhas.length === 0;
}
window.autoteste = autoteste;

/* ===================== INICIALIZAÇÃO ===================== */
function iniciar() {
  const nivelSalvo = lerArmazenado(CHAVES.nivel, estado.nivel);
  const nomenSalva = lerArmazenado(CHAVES.nomenclatura, estado.nomenclatura);
  if (nivelSalvo in NIVEIS) estado.nivel = nivelSalvo;
  if (nomenSalva in NOMENCLATURAS) estado.nomenclatura = nomenSalva;
  estado.historico = carregarHistorico();

  for (const b of document.querySelectorAll(".abas button")) b.addEventListener("click", () => mostrarTela(b.dataset.tela));
  $("btn-limpar").addEventListener("click", limparHistorico);
  $("btn-voltar").addEventListener("click", () => mostrarTela("quiz"));
  $("nivel-atual").addEventListener("click", () => mostrarTela("ajustes"));

  montarOpcoes();
  renderizarTabela();
  atualizarPlacar();
  mostrarTela("quiz");
  novaPergunta();
  autoteste();
}

iniciar();
