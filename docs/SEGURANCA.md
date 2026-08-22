# Segurança

- Sessões são lidas/renovadas no servidor por `@supabase/ssr`; rotas privadas redirecionam sem usuário válido.
- Somente chave publicável pode chegar ao navegador. `SUPABASE_SECRET_KEY` é exclusivamente server-side e não é usada em fluxos comuns.
- RLS é a fronteira definitiva, baseada em `auth.uid()`, usuário não bloqueado e vínculos ativos.
- Auditoria é append-only: clientes podem inserir eventos permitidos, nunca alterar/excluir.
- Buckets clínicos são privados; nomes devem ser UUID, downloads usam URL assinada curta e todo acesso será auditado.
- Logs não incluem tokens, senhas, chaves, payload clínico ou identificadores além do necessário.
- Backups: PITR do Supabase conforme plano contratado e exportação criptografada, periódica e testada para cofre independente.

## Ameaças tratadas

Isolamento de tenant/unidade, elevação por nome de perfil, usuário bloqueado, acesso anônimo, bypass por chave pública, enumeração de rotas e mutação de auditoria.
