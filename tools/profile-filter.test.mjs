import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const html = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'docs', 'app.js'), 'utf8');
const P = require(path.join(root, 'docs', 'profile-filter.js'));

// Página e integração.
assert.match(html, /id="profileToggle"/);
assert.match(html, /id="profileDialog"/);
assert.match(html, /profile-filter\.js[^\n]*defer[\s\S]*app\.js/);
assert.match(app, /jobMatchesProfile\(job\)/);
assert.match(app, /window\.location\.hash/);

// Perfil de exemplo (genérico; o perfil real de cada pessoa fica no navegador dela).
const compiled = P.compileProfile({
  cargos: 'gerente, coordenador, carteira pj',
  locais: 'sp, campinas',
  excluir: 'estágio, assistente',
  somenteFinanceiro: true
});
const job = (title, company, location) => ({ title, company, location });

assert.equal(P.matchesProfile(job('Gerente de Agência', 'Banco Exemplo', 'Campinas, SP'), compiled), true);
assert.equal(P.matchesProfile(job('Coordenador Comercial', 'Sicoob Exemplo', 'São Paulo, SP, BR'), compiled), true);
assert.equal(P.matchesProfile(job('Assistente de Gerente', 'Banco Exemplo', 'Campinas, SP'), compiled), false, 'termo excluído');
assert.equal(P.matchesProfile(job('Analista de Dados', 'Banco Exemplo', 'Campinas, SP'), compiled), false, 'cargo fora do perfil');
assert.equal(P.matchesProfile(job('Gerente de Loja', 'Supermercado Exemplo', 'Campinas, SP'), compiled), false, 'fora do setor financeiro');
assert.equal(P.matchesProfile(job('Gerente de Agência', 'Banco Exemplo', 'Curitiba, PR'), compiled), false, 'local fora do perfil');

// Palavras inteiras: "sp" não casa com "espirito" e "pan" não casa com "panificadora".
assert.equal(P.matchesProfile(job('Gerente', 'Banco Exemplo', 'Espirito Santo, ES'), compiled), false);
assert.equal(P.isFinancialCompany('Panificadora Pão Bom'), false);
assert.equal(P.isFinancialCompany('Banco PAN'), true);
assert.equal(P.isFinancialCompany('Rede D\'Or'), false);
assert.equal(P.isFinancialCompany('Ouro Safra'), false);
assert.equal(P.isFinancialCompany('Safra'), true);
assert.equal(P.isFinancialCompany('SICOOB CREDSEGURO'), true);
assert.equal(P.isFinancialCompany('Fundação Cultural e de Fomento'), false);

// Sem a trava do setor financeiro, outras empresas aparecem.
const allCompanies = P.compileProfile({ cargos: 'gerente', locais: '', excluir: '', somenteFinanceiro: false });
assert.equal(P.matchesProfile(job('Gerente de Loja', 'Supermercado Exemplo', 'Campinas, SP'), allCompanies), true);

// Perfil vazio não ativa o filtro.
assert.equal(P.isProfileEmpty(P.emptyProfile()), true);

// Link pessoal: ida e volta.
const params = P.profileToParams({ cargos: 'gerente', locais: 'sp', excluir: 'estágio', somenteFinanceiro: false }, new URLSearchParams());
const back = P.profileFromParams(new URLSearchParams(params.toString()));
assert.deepEqual(back, { cargos: 'gerente', locais: 'sp', excluir: 'estágio', somenteFinanceiro: false });
assert.equal(P.profileFromParams(new URLSearchParams('perfil=1')), null);

// Armazenamento local tolera falhas do navegador.
const memory = new Map();
const storage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
assert.equal(P.saveProfile(storage, { cargos: 'gerente' }), true);
assert.equal(P.loadProfile(storage).cargos, 'gerente');
assert.equal(P.loadProfile({ getItem() { throw new Error('bloqueado'); } }), null);

console.log('profile-filter: ok');
