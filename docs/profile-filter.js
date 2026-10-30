// Filtro "Vagas para o meu perfil".
// O perfil de cada pessoa fica só no navegador dela (localStorage) ou no link
// pessoal que ela guarda; este arquivo traz apenas a regra de comparação e a
// lista genérica de empresas do setor financeiro.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.TodasAsVagasProfile = api;
  }
})(globalThis, function () {
  'use strict';

  const STORAGE_KEY = 'tav-meu-perfil-v1';

  // Nomes de empresas do setor financeiro: bancos, cooperativas de crédito,
  // financeiras, seguradoras, meios de pagamento e fintechs. Os termos são
  // comparados como palavras inteiras para evitar casos como "Rede D'Or".
  const FINANCIAL_COMPANY_TERMS = [
    'banco', 'bank', 'banking', 'bancoob', 'financeira', 'financial', 'financas',
    'credito', 'cooperativa de credito', 'cooperativa credito', 'coop credito',
    'sicoob', 'sicredi', 'unicred', 'cresol', 'ailos', 'viacredi', 'uniprime', 'credisis',
    'credicoamo', 'bradesco', 'santander', 'itau', 'itau unibanco', 'caixa economica', 'brb',
    'banrisul', 'banestes', 'banpara', 'banese', 'bnb', 'brde', 'basa',
    'banco safra', 'safrapay', 'daycoval', 'pagbank', 'pagseguro', 'inter carreiras', 'banco inter',
    'c6 bank', 'btg', 'btg pactual', 'xp inc', 'agibank', 'bmg', 'sofisa', 'banco pan', 'banco bv',
    'abc brasil', 'banco fibra', 'banco pine', 'banco original', 'banco mercantil', 'tribanco',
    'omni co', 'creditas', 'rabobank', 'john deere financial', 'cnh capital', 'terramagna',
    'porto seguro', 'porto bank', 'seguros', 'seguradora', 'previdencia', 'capitalizacao',
    'consorcio', 'investimentos', 'corretora de cambio', 'corretora de valores', 'stone pagamentos',
    'cielo', 'getnet', 'picpay', 'mercado pago', 'nubank', 'asaas', 'ebanx', 'sumup', 'ourinvest',
    'ouribank', 'fomento mercantil', 'fidc', 'securitizadora'
  ];

  // Marcas curtas que só contam quando são o nome inteiro da empresa,
  // para não confundir "Safra" (banco) com "Ouro Safra" (agro).
  const FINANCIAL_EXACT_NAMES = [
    'safra', 'pan', 'bv', 'inter', 'omni', 'cora', 'wise', 'stone', 'original', 'pine', 'fibra',
    'mercantil', 'porto', 'nomad', 'xp', 'c6'
  ];

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function parseTerms(value) {
    const list = Array.isArray(value) ? value : String(value || '').split(',');
    return [...new Set(list.map(normalize).filter(Boolean))];
  }

  // Compara palavras inteiras: "pan" não casa com "panificadora" e
  // "go" não casa com "google".
  function containsTerm(text, term) {
    if (!text || !term) return false;
    return ` ${text} `.includes(` ${term} `);
  }

  function containsAny(text, terms) {
    return terms.some(term => containsTerm(text, term));
  }

  function emptyProfile() {
    return { cargos: '', locais: '', excluir: '', somenteFinanceiro: true };
  }

  function sanitizeProfile(raw) {
    const base = emptyProfile();
    if (!raw || typeof raw !== 'object') return base;
    return {
      cargos: String(raw.cargos || ''),
      locais: String(raw.locais || ''),
      excluir: String(raw.excluir || ''),
      somenteFinanceiro: raw.somenteFinanceiro !== false
    };
  }

  function isProfileEmpty(profile) {
    const p = sanitizeProfile(profile);
    return !parseTerms(p.cargos).length && !parseTerms(p.locais).length;
  }

  function compileProfile(profile) {
    const p = sanitizeProfile(profile);
    return {
      cargos: parseTerms(p.cargos),
      locais: parseTerms(p.locais),
      excluir: parseTerms(p.excluir),
      somenteFinanceiro: p.somenteFinanceiro,
      financialTerms: parseTerms(FINANCIAL_COMPANY_TERMS),
      financialExact: new Set(parseTerms(FINANCIAL_EXACT_NAMES))
    };
  }

  function isFinancialName(name, compiled) {
    return compiled.financialExact.has(name) || containsAny(name, compiled.financialTerms);
  }

  function isFinancialCompany(company, compiled) {
    return isFinancialName(normalize(company), compiled || compileProfile(emptyProfile()));
  }

  // Textos já normalizados; o site guarda esses valores em cada vaga para
  // não repetir a normalização a cada clique.
  function matchesNormalized(title, company, location, compiled) {
    if (!compiled) return true;
    if (compiled.cargos.length && !containsAny(title, compiled.cargos)) return false;
    if (compiled.excluir.length && containsAny(title, compiled.excluir)) return false;
    if (compiled.locais.length && !containsAny(location, compiled.locais)) return false;
    if (compiled.somenteFinanceiro && !isFinancialName(company, compiled)) return false;
    return true;
  }

  // job: { title, company, location }
  function matchesProfile(job, compiled) {
    return matchesNormalized(normalize(job.title), normalize(job.company), normalize(job.location), compiled);
  }

  function loadProfile(storage) {
    try {
      const raw = storage && storage.getItem(STORAGE_KEY);
      return raw ? sanitizeProfile(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  function saveProfile(storage, profile) {
    try {
      if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProfile(profile)));
      return true;
    } catch {
      return false;
    }
  }

  // Link pessoal: leva o perfil no endereço para abrir em outro aparelho.
  function profileToParams(profile, params) {
    const p = sanitizeProfile(profile);
    params.set('perfil', '1');
    if (p.cargos.trim()) params.set('pcargos', p.cargos.trim());
    if (p.locais.trim()) params.set('plocais', p.locais.trim());
    if (p.excluir.trim()) params.set('pexcluir', p.excluir.trim());
    if (!p.somenteFinanceiro) params.set('ptodas', '1');
    return params;
  }

  function profileFromParams(params) {
    if (!params.has('pcargos') && !params.has('plocais') && !params.has('pexcluir')) return null;
    return sanitizeProfile({
      cargos: params.get('pcargos') || '',
      locais: params.get('plocais') || '',
      excluir: params.get('pexcluir') || '',
      somenteFinanceiro: params.get('ptodas') !== '1'
    });
  }

  return Object.freeze({
    STORAGE_KEY,
    FINANCIAL_COMPANY_TERMS,
    FINANCIAL_EXACT_NAMES,
    normalize,
    parseTerms,
    emptyProfile,
    sanitizeProfile,
    isProfileEmpty,
    compileProfile,
    isFinancialCompany,
    matchesNormalized,
    matchesProfile,
    loadProfile,
    saveProfile,
    profileToParams,
    profileFromParams
  });
});
