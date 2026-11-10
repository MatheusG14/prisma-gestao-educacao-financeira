# Prisma — Gestão e Educação Financeira

Aplicação web para organização financeira pessoal, acompanhamento patrimonial e educação financeira. O Prisma reúne dashboard, receitas, despesas, contas, cartões, metas, investimentos, relatórios, trilhas educacionais e recursos do Prisma AI em uma única interface.

## Visão geral

O projeto oferece:

- Dashboard com indicadores financeiros e visão consolidada;
- cadastro e acompanhamento de receitas e despesas;
- gerenciamento de contas, cartões e transações;
- metas financeiras e acompanhamento de evolução;
- carteira de ativos e investimentos;
- centro financeiro com indicadores, histórico e projeções;
- relatórios e busca global;
- trilha de educação financeira com guias em PDF;
- Prisma AI para planos e análises financeiras;
- consentimento e histórico relacionados à LGPD;
- backend opcional com autenticação, sessões e persistência em SQLite.

> O Prisma é uma ferramenta de organização e educação financeira. Seus indicadores são informativos e não substituem orientação profissional, contábil ou de investimentos.

## Tecnologias

- HTML5, CSS3 e JavaScript;
- Node.js 20 ou superior;
- servidor HTTP nativo do Node.js;
- SQLite com modo WAL;
- testes nativos com node:test;
- autenticação local no navegador com IndexedDB;
- autenticação do backend com scrypt, sessões e cookies HttpOnly.

## Pré-requisitos

- Node.js 20 ou superior;
- npm;
- navegador moderno com suporte a JavaScript e IndexedDB.

Node.js 22 ou 24 é recomendado para desenvolvimento.

## Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/MatheusG14/prisma-gestao-educacao-financeira.git
cd prisma-gestao-educacao-financeira
npm install
```

O projeto possui dependências mínimas e utiliza recursos nativos do Node.js.

## Execução

### Servidor backend

```bash
npm start
```

Por padrão, o servidor fica disponível em http://localhost:3000. Também é possível iniciar o backend no Windows executando START_BACKEND.bat.

Para desenvolvimento:

```bash
npm run dev
```

A porta pode ser alterada com PORT. No Windows PowerShell:

```powershell
$env:PORT=3009
npm start
```

### Interface estática

O arquivo index.html pode ser aberto em um servidor estático. Para utilizar recursos dependentes do backend, execute npm start e acesse a aplicação pelo navegador. No Windows, INICIAR_PRISMA.bat pode ser usado conforme a configuração local.

## Configuração opcional

Copie .env.example para .env e preencha somente os serviços desejados:

```powershell
copy .env.example .env
```

As configurações incluem SMTP para recuperação de senha e envio de PDFs, limites de envio, duração de sessões, URL pública e administrador inicial. Nunca versione senhas, tokens ou credenciais reais. O arquivo .env deve permanecer fora do repositório.

## Autenticação e persistência

### Modo local do navegador

- cadastro e login usam IndexedDB;
- senhas não são armazenadas em texto puro;
- o navegador deriva hashes PBKDF2/SHA-256 com salt individual;
- sessão e dados ficam vinculados ao navegador e ao dispositivo;
- limpar os dados do navegador pode remover registros locais;
- essa autenticação não deve ser usada como autorização confiável para dados compartilhados.

### Backend

Quando o servidor é executado:

- usuários e estados financeiros são persistidos em prisma.sqlite;
- senhas usam scrypt com salt aleatório;
- sessões usam tokens criptograficamente seguros;
- cookies de sessão usam HttpOnly e proteção SameSite;
- receitas, despesas, contas, cartões, metas, investimentos e histórico do Prisma AI ficam no SQLite;
- os dados permanecem após reiniciar o servidor.

As contas do modo local e as contas do backend são mecanismos separados e não são migradas automaticamente entre si.

## API principal

| Grupo | Recursos |
|---|---|
| Saúde | GET /api/health |
| Autenticação | registro, login, logout, sessão e recuperação de senha |
| Estado financeiro | GET/PUT /api/state |
| Prisma AI | estado, planos e análises |
| LGPD | consentimento e histórico |
| Conta | atualização e exclusão da conta |
| Insights | consulta e registro de insights |

As rotas protegidas exigem uma sessão autenticada.

## Testes

Suíte principal:

```bash
npm test
```

Auditorias:

```bash
npm run test:audit
```

Os testes cobrem persistência, autenticação, sessões, estado financeiro, dashboard, modais, finance engine, monitoramento, Prisma AI e visualização de PDFs. As auditorias verificam segurança, isolamento por usuário, IDs DOM, contratos data-section, CSS, ícones e estrutura das telas.

Para autenticação:

```bash
npm run test:auth
```

## Estrutura do projeto

```text
.
├── assets/
│   ├── images/                  # Logos, favicons e imagens
│   └── pdfs/                    # PDFs usados pela aplicação
├── conteudos/
│   └── educacao-financeira/     # Guias educacionais em PDF
├── css/                         # Folhas de estilo
├── js/                          # Scripts e motores financeiros
├── telas/                       # Telas HTML
│   └── components/              # Navbar, sidebar e modais reutilizáveis
├── tests/                       # Testes e auditorias
├── index.html                   # Interface principal
├── server.js                    # Backend HTTP e API
├── prisma.sqlite                # Banco SQLite local
├── package.json                 # Scripts e metadados npm
├── .env.example                 # Modelo de configuração
└── README.md                    # Esta documentação
```

## Banco de dados

prisma.sqlite é o banco local da aplicação. prisma.sqlite-shm e prisma.sqlite-wal são arquivos auxiliares do modo WAL do SQLite. Faça cópias de segurança antes de operações de manutenção e não compartilhe o banco se ele contiver dados financeiros reais.

## Segurança e privacidade

- não armazene credenciais no código;
- use .env para configurações sensíveis;
- use HTTPS e configuração de produção adequada ao publicar;
- não trate autenticação exclusivamente frontend como controle de acesso;
- proteja backups do SQLite;
- revise as configurações SMTP antes de habilitar e-mails;
- trate dados financeiros como informação sensível.

## Autores

Projeto criado por:

- **Matheus Gomes Costa Teixeira**
- **Erick Bruno Ferreira dos Santos**
- **Luan Rodrigues de Souza**
- **Tiago Mendes Ferreira**
- **Michael Fernando Santos Guimarães**

## Licença

Este repositório não declara uma licença de código aberto. Consulte os autores antes de redistribuir, modificar ou utilizar o projeto fora do contexto autorizado.
# Prisma — Gestão Financeira Inteligente

O Prisma oferece uma interface web HTML e serviços de backend opcionais. A autenticação do site HTML é local; ela não é uma autenticação segura em servidor nem deve ser usada como controle de acesso para dados financeiros compartilhados.

## Autenticação local do site HTML
- Cadastro e login usam IndexedDB no navegador. A senha nunca é armazenada em texto puro: o navegador deriva um hash PBKDF2/SHA-256 com salt individual.
- A sessão guarda somente o identificador da conta no armazenamento do navegador. O logout encerra a sessão e preserva o cadastro e os dados financeiros.
- Contas, sessão e dados ficam vinculados ao navegador/dispositivo; não há sincronização automática entre dispositivos. Limpar os dados do navegador pode causar perda dos registros locais.
- A autenticação exclusivamente no frontend pode ser contornada por alguém com controle sobre o navegador. Não use esse mecanismo como autorização confiável de dados compartilhados.
- Não há recuperação de senha por e-mail para contas locais: isso exigiria verificação confiável do usuário fora do navegador.

## Backend e armazenamento do servidor
Quando executado, o backend mantém seus próprios dados e autenticação em SQLite. Esses recursos são distintos das contas criadas no modo HTML local e não migram automaticamente entre si.
- **Banco de Dados Real**: Persistência transacional em arquivo SQLite (`prisma.sqlite`) com modo WAL e integridade referencial.
- **Usuários e Senhas**: Senhas protegidas com derivação criptográfica `scrypt` e salt aleatório de 16 bytes. Senhas nunca são salvas ou trafegadas em texto puro.
- **Sessões**: Tokens de autenticação criptograficamente seguros persistidos no SQLite com renovação automática e cookies `HttpOnly` com proteção CSRF/SameSite.
- **Estado Financeiro**: Todas as receitas, despesas, contas, cartões, metas, investimentos e histórico do Prisma AI persistem no banco de dados SQLite real.
- **Ao reiniciar o servidor**: Nenhum dado é perdido. Todos os usuários e estados continuam salvos no banco SQLite.

Funções que enviam PDFs por e-mail, administração, sincronização ou usam outros serviços externos continuam dependendo das respectivas integrações de backend. A autenticação local não cria uma sessão nesses serviços.

## Executar
```bash
# Iniciar o servidor
npm start
```
Ou no Windows, dê dois cliques em `START_BACKEND.bat`.

Requer Node.js 20+ (recomendado Node.js 22 ou 24).

## Testes
```bash
npm test
```
Executa a suíte de testes de persistência, autenticação, finance engine, monitoramento e IA.
