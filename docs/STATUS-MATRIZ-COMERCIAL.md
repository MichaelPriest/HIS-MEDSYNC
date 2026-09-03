# Estado do pacote — Matriz comercial contextual

- Branch: `feat/comercial-matriz-cenarios`
- Base: `feat/comercial-editavel-historico-depara-auto` / PR #134
- Migration aplicada no Supabase: `20260903145847_comercial_matriz_cenarios_contextuais`
- Nova rota: `/comercial/matriz`
- RPC: `comercial_simular_matriz_cenarios`
- Persistência: somente leitura; nenhum preço, snapshot, vínculo, regra ou DePara é criado pela matriz.
- Gate: CI + Vercel Preview devem ser verdes no mesmo SHA antes de incorporar à cadeia cumulativa.
