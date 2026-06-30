// ─────────────────────────────────────────────────────────────
//  Gerador de Remessa CNAB 240 — SICREDI (Banco 748)
//  Pagamento via PIX (Forma 45 — PIX Transferência)
//
//  Layout baseado no manual SICREDI v8.2 e no arquivo de amostra
//  PG240401.REM. Cada linha possui exatamente 240 caracteres.
// ─────────────────────────────────────────────────────────────

// Dados do beneficiário (Crosby) — vir do sample. Idealmente
// deve ser carregado de configurações no Supabase.
export const EMPRESA_SICREDI = {
  cnpj: '17177680000116',
  nome: 'CROSBY DISTRIBUICAO E CONFECCA',
  agencia: '02207',
  dvAgencia: '1',
  conta: '000000036733',
  dvConta: '8',
  convenio: '5BEK', // será preenchido para 20 posições
  endereco: {
    logradouro: 'R SAO JOSE',
    numero: '02189',
    complemento: '',
    cidade: 'NATAL',
    cep: '59063150',
    uf: 'RN',
  },
};

// ─── Helpers ────────────────────────────────────────────────
const padL = (v, n, c = '0') =>
  String(v ?? '')
    .slice(0, n)
    .padStart(n, c);
const padR = (v, n, c = ' ') =>
  String(v ?? '')
    .slice(0, n)
    .padEnd(n, c);
const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '');
const semAcento = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const clean = (s) =>
  semAcento(s)
    .toUpperCase()
    .replace(/[^A-Z0-9 ./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const fmtDataDDMMYYYY = (d) => {
  if (!d) return '00000000';
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : new Date(d);
  if (isNaN(dt.getTime())) return '00000000';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear());
  return `${dd}${mm}${yy}`;
};

const fmtHoraHHMMSS = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;

const valorCentavos = (v) => Math.round(parseFloat(v || 0) * 100);

// Detecta o tipo de chave PIX (Nota G022 do manual SICREDI).
// Domínio: 01=Telefone, 02=E-mail, 03=CPF/CNPJ, 04=Aleatória, 05=Dados bancários.
// Retorna { tipo, valor, cpfCnpj }. tipo '00' = não reconhecida (inválida).
//
// Observação: uma chave de telefone "crua" com 11 dígitos é ambígua com CPF.
// Para desambiguar, telefone deve vir prefixado (+55…) ou formatado ((81) 9…).
// Um número cru de 11/14 dígitos é tratado como CPF/CNPJ.
export function detectarChavePix(chave) {
  const k = String(chave || '').trim();
  if (!k) return { tipo: '00', valor: '', cpfCnpj: '' };
  const d = onlyDigits(k);
  // E-mail → sempre minúsculo (Nota G023)
  if (/^[\w.+-]+@[\w.-]+\.\w{2,}$/.test(k))
    return { tipo: '02', valor: k.toLowerCase(), cpfCnpj: '' };
  // Chave aleatória (UUID/EVP)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k))
    return { tipo: '04', valor: k.toLowerCase(), cpfCnpj: '' };
  // Telefone explícito (prefixo + ou marcas de formatação) — antes do CPF
  const ehTelefoneExplicito = /^\+/.test(k) || /[()\s-]/.test(k.trim());
  if (ehTelefoneExplicito && d.length >= 10 && d.length <= 13)
    return {
      tipo: '01',
      valor: d.startsWith('55') ? `+${d}` : `+55${d}`,
      cpfCnpj: '',
    };
  if (d.length === 11 && k === d) return { tipo: '03', valor: d, cpfCnpj: d };
  if (d.length === 14 && k === d) return { tipo: '03', valor: d, cpfCnpj: d };
  // Telefone cru (10-13 dígitos) que não é CPF/CNPJ
  if (d.length >= 10 && d.length <= 13)
    return {
      tipo: '01',
      valor: d.startsWith('55') ? `+${d}` : `+55${d}`,
      cpfCnpj: '',
    };
  return { tipo: '00', valor: k, cpfCnpj: '' };
}

const ROTULO_TIPO_CHAVE = {
  '01': 'Telefone',
  '02': 'E-mail',
  '03': 'CPF/CNPJ',
  '04': 'Chave aleatória',
  '05': 'Dados bancários',
  '00': 'Não reconhecida',
};

export function rotuloTipoChave(tipo) {
  return ROTULO_TIPO_CHAVE[tipo] || 'Desconhecida';
}

// ─── Header de Arquivo (tipo 0) ─────────────────────────────
function gerarHeaderArquivo(empresa, seqArquivo, dataGeracao) {
  const linha =
    '748' + // 1-3   banco
    '0000' + // 4-7   lote
    '0' + // 8     tipo
    padR('', 9) + // 9-17  FEBRABAN
    '2' + // 18    tipo insc (CNPJ)
    padL(empresa.cnpj, 14) + // 19-32 CNPJ
    padR(empresa.convenio, 20) + // 33-52 convênio
    padL(empresa.agencia, 5) + // 53-57 agência
    padL(empresa.dvAgencia, 1) + // 58    DV
    padL(empresa.conta, 12) + // 59-70 conta
    padL(empresa.dvConta, 1) + // 71    DV conta
    padR('', 1) + // 72    DV ag/conta
    padR(clean(empresa.nome), 30) + // 73-102 nome empresa
    padR('SICREDI', 30) + // 103-132 nome banco
    padR('', 10) + // 133-142 FEBRABAN
    '1' + // 143 cód remessa
    fmtDataDDMMYYYY(dataGeracao) + // 144-151 data
    fmtHoraHHMMSS(dataGeracao) + // 152-157 hora
    padL(seqArquivo, 6) + // 158-163 seq arquivo
    '082' + // 164-166 versão layout
    '01600' + // 167-171 densidade
    padR('', 20) + // 172-191 reservado banco
    padR('', 20) + // 192-211 reservado empresa
    padR('', 29); // 212-240 uso exclusivo
  return linha.padEnd(240, ' ').slice(0, 240);
}

// ─── Header de Lote (tipo 1) — PIX Transferência ────────────
function gerarHeaderLote(empresa, nrLote) {
  const linha =
    '748' +
    padL(nrLote, 4) +
    '1' +
    'C' + // 9   tipo oper (crédito)
    '20' + // 10-11 tipo serv (pagamento fornecedor)
    '45' + // 12-13 forma lançamento (PIX Transferência)
    '042' + // 14-16 layout lote
    padR('', 1) + // 17 FEBRABAN
    '2' + // 18 tipo insc
    padL(empresa.cnpj, 14) +
    padR(empresa.convenio, 20) +
    padL(empresa.agencia, 5) +
    padL(empresa.dvAgencia, 1) +
    padL(empresa.conta, 12) +
    padL(empresa.dvConta, 1) +
    padR('', 1) + // DV ag/conta
    padR(clean(empresa.nome), 30) + // 73-102
    padR('', 40) + // 103-142 mensagem
    padR(clean(empresa.endereco.logradouro), 30) + // 143-172
    padL(empresa.endereco.numero, 5) + // 173-177
    padR(clean(empresa.endereco.complemento), 15) + // 178-192
    padR(clean(empresa.endereco.cidade), 20) + // 193-212
    padL(onlyDigits(empresa.endereco.cep), 8) + // 213-220
    padR(empresa.endereco.uf, 2) + // 221-222
    padR('', 8) + // 223-230 FEBRABAN
    padR('', 10); // 231-240 ocorrências
  return linha.padEnd(240, ' ').slice(0, 240);
}

// ─── Segmento A — dados do pagamento ────────────────────────
function gerarSegmentoA(nrLote, seqReg, titulo, dataPgto) {
  const vlCent = valorCentavos(titulo.vl_real ?? titulo.vl_duplicata);
  const linha =
    '748' +
    padL(nrLote, 4) +
    '3' +
    padL(seqReg, 5) +
    'A' +
    '000' + // 15-17 movimento (inclusão)
    '009' + // 18-20 câmara (009 = PIX)
    '000' + // 21-23 banco favorecido (não usado p/ PIX)
    padL('', 5) + // 24-28 ag fav
    '0' + // 29 DV
    padL('', 12) + // 30-41 conta fav
    padR('', 1) + // 42 DV
    padR('', 1) + // 43 DV ag/conta
    padR(clean(titulo.nm_fornecedor), 30) + // 44-73 nome fav
    padR(onlyDigits(titulo.nr_duplicata) || padL(seqReg, 20), 20) + // 74-93 nº doc empresa
    fmtDataDDMMYYYY(dataPgto) + // 94-101 data pgto
    'BRL' + // 102-104
    padL('0', 15) + // 105-119 quant moeda
    padL(vlCent, 15) + // 120-134 valor
    padR('', 20) + // 135-154 nº doc banco (brancos)
    padL('0', 8) + // 155-162 data real do pagamento (zeros)
    padL('0', 15) + // 163-177 valor real do pagamento (zeros)
    padR('', 40) + // 178-217 informação 2 (mensagem)
    padR('', 2) + // 218-219 filler
    padR('', 5) + // 220-224 finalidade da TED
    padR('', 2) + // 225-226 código finalidade complementar
    padR('', 3) + // 227-229 filler
    '0' + // 230 emissão de aviso ao favorecido
    padR('', 10); // 231-240 ocorrências
  return linha.padEnd(240, ' ').slice(0, 240);
}

// ─── Segmento B — PIX (Nota G022/G023/G024 do manual) ───────
//  Layout PIX Transferência (forma 45):
//   15-16 tipo de identificação da chave PIX (01/02/03/04)
//   18    tipo de inscrição (0=não informado / 1=CPF / 2=CNPJ)
//   19-32 CPF/CNPJ do favorecido (a própria chave quando tipo 03)
//   128-226 chave PIX (telefone/e-mail/aleatória); EM BRANCO p/ CPF/CNPJ
function gerarSegmentoB(nrLote, seqReg, titulo) {
  const info = detectarChavePix(titulo.chave_pix);
  // CPF/CNPJ do favorecido: para tipo 03 é a própria chave; para os demais,
  // tenta obter dos dados do título (opcional — não é validado pelo banco).
  const cpfCnpj =
    info.cpfCnpj ||
    onlyDigits(titulo.dados_completos?.nr_cgcpessoa) ||
    onlyDigits(titulo.dados_completos?.cnpj) ||
    onlyDigits(titulo.dados_completos?.cpf) ||
    onlyDigits(titulo.supplier_cpf_cnpj) ||
    '';
  const tipoInsc =
    cpfCnpj.length === 11 ? '1' : cpfCnpj.length === 14 ? '2' : '0';

  // Chave PIX que vai nas posições 128-226 (apenas telefone/e-mail/aleatória).
  // Para chave CPF/CNPJ (03), essas posições ficam em branco (Nota G024).
  const chavePix128 = info.tipo === '03' ? '' : info.valor;

  const linha =
    '748' +
    padL(nrLote, 4) +
    '3' +
    padL(seqReg, 5) +
    'B' +
    padR(info.tipo, 2) + // 15-16 tipo de identificação da chave PIX
    padR('', 1) + // 17    filler
    tipoInsc + // 18    tipo de inscrição
    padL(cpfCnpj, 14) + // 19-32 CPF/CNPJ (ou zeros)
    padR('', 30) + // 33-62  informação 10 (TX ID — opcional)
    padR('', 65) + // 63-127 informação 11 (recomendado em branco)
    padR(chavePix128, 99) + // 128-226 chave PIX
    padR('', 6) + // 227-232 uso reservado do banco
    padR('', 8); // 233-240 filler
  return linha.padEnd(240, ' ').slice(0, 240);
}

// ─── Trailer Lote (tipo 5) ──────────────────────────────────
function gerarTrailerLote(nrLote, qtdRegistros, somatorioCentavos) {
  const linha =
    '748' +
    padL(nrLote, 4) +
    '5' +
    padR('', 9) + // 9-17
    padL(qtdRegistros, 6) + // 18-23
    padL(somatorioCentavos, 18) + // 24-41
    padL('0', 18) + // 42-59 soma quantidade
    padL('0', 6) + // 60-65 nº aviso débito
    padR('', 165) + // 66-230
    padR('', 10); // 231-240
  return linha.padEnd(240, ' ').slice(0, 240);
}

// ─── Trailer Arquivo (tipo 9) ───────────────────────────────
function gerarTrailerArquivo(qtdLotes, qtdRegistros) {
  const linha =
    '748' +
    '9999' +
    '9' +
    padR('', 9) + // 9-17
    padL(qtdLotes, 6) + // 18-23
    padL(qtdRegistros, 6) + // 24-29
    padL('0', 6) + // 30-35 qt contas conciliação
    padR('', 205); // 36-240
  return linha.padEnd(240, ' ').slice(0, 240);
}

// ─── Validação / Governança ─────────────────────────────────
//  Valida os títulos ANTES de gerar o arquivo. Retorna a lista de
//  erros (bloqueiam a geração) e avisos (não bloqueiam).
export function validarTitulosRemessa(titulos, empresa = EMPRESA_SICREDI) {
  const erros = [];
  const avisos = [];

  if (!Array.isArray(titulos) || titulos.length === 0) {
    erros.push('Nenhum título selecionado para gerar a remessa.');
    return { erros, avisos };
  }

  // Limite do manual: até 5.000 movimentos por lote
  if (titulos.length > 5000) {
    erros.push(
      `Quantidade de títulos (${titulos.length}) excede o limite de 5.000 por lote.`,
    );
  }

  // Sanidade da configuração do convênio (empresa pagadora)
  if (onlyDigits(empresa.cnpj).length !== 14)
    erros.push('CNPJ da empresa pagadora inválido na configuração SICREDI.');
  if (!onlyDigits(empresa.agencia) || !onlyDigits(empresa.conta))
    erros.push('Agência/conta da empresa pagadora ausente na configuração.');
  if (!String(empresa.convenio || '').trim())
    erros.push('Código do convênio SICREDI ausente na configuração.');

  const vistos = new Map();
  titulos.forEach((t, i) => {
    const ref = t.nm_fornecedor || t.nr_duplicata || `linha ${i + 1}`;

    if (!String(t.nm_fornecedor || '').trim())
      erros.push(`${ref}: nome do favorecido ausente.`);

    const valor = parseFloat(t.vl_real ?? t.vl_duplicata ?? 0);
    if (!(valor > 0))
      erros.push(`${ref}: valor do pagamento inválido (${valor}).`);

    if (String(t.forma_pagamento || '').toUpperCase() !== 'PIX')
      erros.push(`${ref}: forma de pagamento não é PIX.`);

    const info = detectarChavePix(t.chave_pix);
    if (!String(t.chave_pix || '').trim()) {
      erros.push(`${ref}: chave PIX não informada.`);
    } else if (info.tipo === '00') {
      erros.push(
        `${ref}: chave PIX não reconhecida ("${t.chave_pix}"). ` +
          'Use CPF/CNPJ, e-mail, telefone (+55…) ou chave aleatória.',
      );
    } else if (info.tipo === '05') {
      erros.push(`${ref}: PIX por dados bancários não é suportado na remessa.`);
    }

    // Chave telefone com 11 dígitos é ambígua com CPF — alerta de conferência
    const d = onlyDigits(t.chave_pix);
    if (info.tipo === '03' && d.length === 11)
      avisos.push(
        `${ref}: chave tratada como CPF (${d}). ` +
          'Se for telefone, informe com +55.',
      );

    // Duplicidade dentro do mesmo arquivo (governança anti-pagamento-duplo)
    const chaveDup = [
      clean(t.nm_fornecedor),
      onlyDigits(t.nr_duplicata),
      String(t.dt_vencimento || '').slice(0, 10),
      valorCentavos(valor),
    ].join('|');
    if (vistos.has(chaveDup))
      avisos.push(
        `${ref}: possível duplicidade com ${vistos.get(chaveDup)} ` +
          '(mesmo fornecedor, duplicata, vencimento e valor).',
      );
    else vistos.set(chaveDup, ref);
  });

  return { erros, avisos };
}

// ─── Gerador principal ──────────────────────────────────────
export function gerarArquivoRemessaSicredi(titulos, opcoes = {}) {
  if (!Array.isArray(titulos) || titulos.length === 0) {
    throw new Error('Nenhum título informado para gerar remessa.');
  }
  const empresa = opcoes.empresa || EMPRESA_SICREDI;

  // Governança: bloqueia geração se houver erros de validação
  if (!opcoes.pularValidacao) {
    const { erros } = validarTitulosRemessa(titulos, empresa);
    if (erros.length > 0) {
      throw new Error('Remessa bloqueada:\n• ' + erros.join('\n• '));
    }
  }
  const seqArquivo = opcoes.seqArquivo || 1;
  const nrLote = 1;
  const dataGeracao = opcoes.dataGeracao || new Date();
  const dataPagamento = opcoes.dataPagamento || new Date();

  const linhas = [];
  linhas.push(gerarHeaderArquivo(empresa, seqArquivo, dataGeracao));
  linhas.push(gerarHeaderLote(empresa, nrLote));

  let seqReg = 1;
  let somaCent = 0;
  for (const t of titulos) {
    linhas.push(gerarSegmentoA(nrLote, seqReg++, t, dataPagamento));
    linhas.push(gerarSegmentoB(nrLote, seqReg++, t));
    somaCent += valorCentavos(t.vl_real ?? t.vl_duplicata);
  }

  // trailer lote: qtd registros = header(1) + detalhes + trailer(1)
  const qtdRegLote = 2 + titulos.length * 2;
  linhas.push(gerarTrailerLote(nrLote, qtdRegLote, somaCent));

  // trailer arquivo: qtd total = header arq + header lote + detalhes + trailer lote + trailer arq
  const qtdRegArq = 4 + titulos.length * 2;
  linhas.push(gerarTrailerArquivo(1, qtdRegArq));

  // Governança: toda linha CNAB DEVE ter exatamente 240 caracteres.
  linhas.forEach((l, i) => {
    if (l.length !== 240) {
      throw new Error(
        `Erro interno: linha ${i + 1} gerada com ${l.length} caracteres (esperado 240). Geração abortada.`,
      );
    }
  });

  return linhas.join('\r\n') + '\r\n';
}

// ─── Helper: nome do arquivo com sequencial auto-incrementado ──
// O sequencial reseta a cada novo dia e é persistido via localStorage.
export function proximoNomeArquivoRemessa() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const chave = `remessa_seq_${dd}${mm}`;

  const seq = (parseInt(localStorage.getItem(chave) || '0', 10) || 0) + 1;
  localStorage.setItem(chave, String(seq));

  const seqStr = String(seq).padStart(2, '0');
  return `PG${dd}${mm}${seqStr}.REM`;
}

// Mantido por compatibilidade retroativa
export function nomeArquivoRemessa(seq = 1) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const seqStr = String(seq).padStart(2, '0');
  return `PG${dd}${mm}${seqStr}.REM`;
}
