# Agenda Fácil

Agenda para pequenos negócios de serviço, feita para usar no iPhone como app (PWA): agenda do dia e da semana, **link de agendamento** para o cliente marcar sozinho (`/#/agendar`), texto de horários livres para o WhatsApp, lembretes de amanhã, clientes e backup.

Roda inteiro nas contas do cliente: Supabase (banco, login e regras de acesso) e Cloudflare Pages (site estático).

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_NOME_NEGOCIO
npm run dev
npm test
```

## Estrutura

- `supabase/` esquema do banco (RLS: só o dono cadastrado em `donos` lê e escreve; a página pública só chama `horarios_publicos()` e `agendar_publico()`) e configuração inicial
- `src/lib/` regras puras: horários livres, telefone e WhatsApp, backup
- `src/data/` acesso ao Supabase
- `src/ui/` telas
- `scripts/restore.ts` restauração de backup (roda no computador, com `SUPABASE_DB_URL` no ambiente)

## Implantação e uso

- Checklist de implantação: [`docs/implantacao.md`](docs/implantacao.md)
- Manual do cliente: [`docs/manual-cliente.md`](docs/manual-cliente.md)

## Restaurar um backup

```bash
SUPABASE_DB_URL='postgresql://postgres:SENHA@db.XXXX.supabase.co:5432/postgres' \
  npx tsx scripts/restore.ts backup-agenda-AAAA-MM-DD.json
```

Se o banco já tiver dados, o script para e pede `--confirmar-substituir`, que apaga tudo antes de restaurar.
