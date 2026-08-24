# Segurança

- Sessões são lidas/renovadas no servidor por `@supabase/ssr`; rotas privadas redirecionam sem usuário válido.
- Somente chave publicável pode chegar ao navegador. `SUPABASE_SECRET_KEY` é exclusivamente server-side e não é usada em fluxos comuns.
- RLS é a fronteira definitiva, baseada em `auth.uid()`, usuário não bloqueado e vínculos ativos.
- O RBAC usa códigos de permissão, nunca o nome do perfil. Perfis são agrupadores editáveis e podem ter escopo de empresa ou unidade.
- O menu é filtrado pelas permissões efetivas para reduzir exposição de áreas não pertinentes, mas esconder uma rota não substitui RLS nem autorização server-side.
- A administração de perfis exige `usuarios.administrar`; alterações de matriz/vínculos são registradas em `auditoria_eventos`.
- Helpers `pode_visualizar_acessos(uuid)` e `pode_administrar_acessos(uuid)` são funções `SECURITY DEFINER` estreitas, retornam somente booleano, fixam `search_path=''`, validam exclusivamente `auth.uid()` e têm `EXECUTE` revogado de `public`/`anon`. Elas existem para evitar recursão de RLS nas próprias tabelas de RBAC.
- Auditoria é append-only: clientes podem inserir eventos permitidos, nunca alterar/excluir.
- Buckets clínicos são privados; nomes devem ser UUID, downloads usam URL assinada curta e todo acesso será auditado.
- Logs não incluem tokens, senhas, chaves, payload clínico ou identificadores além do necessário.
- Backups: PITR do Supabase conforme plano contratado e exportação criptografada, periódica e testada para cofre independente.

## Ameaças tratadas

Isolamento de tenant/unidade, elevação por nome de perfil, usuário bloqueado, acesso anônimo, bypass por chave pública, enumeração de rotas, mutação de auditoria, lockout acidental do perfil Administrador e recursão de RLS na gestão de acessos.

## P0 ainda pendente

- aplicar autorização granular a todas as server actions e RPCs sensíveis, além do RLS existente;
- criar testes autenticados com usuários fictícios de empresas/unidades distintas para provar isolamento negativo e positivo;
- implementar acesso emergencial (`break-glass`) com justificativa, prazo curto, auditoria reforçada e revisão posterior;
- criar rotina de recertificação periódica de acessos e segregação de funções críticas;
- testar restauração de backup e procedimento de continuidade de negócio em ambiente de homologação.
