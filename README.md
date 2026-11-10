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
