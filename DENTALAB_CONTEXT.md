# DentaLab - contexto para continuar no Codex

## Visao geral

App single-file em `index.html`, feito com HTML + CSS + JavaScript vanilla.
Nao tem build step, framework ou bundler.

Backend:
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions para Web Push

Deploy atual:
- GitHub Pages
- Arquivos principais no root do repo:
  - `index.html`
  - `manifest.json`
  - `sw.js`
  - `icon-180.png`
  - `icon-192.png`
  - `icon-512.png`
  - `icon-maskable-512.png`

## Tabelas Supabase

Tabelas usadas:
- `profiles`
- `labs`
- `clinic_labs`
- `cases`
- `case_files`
- `case_messages`
- `pending_issues`
- `push_subscriptions`

Storage:
- bucket `case-files`

Edge Function:
- `send-push`

## Roles

Roles principais:
- `dentista`
- `assistente`
- `laboratorio`

A UI e permissoes sao controladas por:
- `currentUserRole`
- `applyRoleUI()`

Conta admin de testes:
- `lucasp299@gmail.com`

Essa conta pode apagar/gerir casos em modo de teste.

## Autenticacao

Fluxo real com Supabase Auth:
- `sbLogin`
- `sbLogout`
- `sbRestoreSession`
- `sbLoadOrCreateProfile`
- `_sbEnterApp`

`_sbEnterApp()` e o ponto central apos login/restauro de sessao.

## Sincronizacao

Realtime:
- `sbStartRealtimeSync()`
- escuta `cases`
- escuta `case_messages`
- escuta `pending_issues`

Polling de seguranca:
- `sbStartBackgroundSync()`
- roda a cada 15s

Funcao central de merge:
- `syncSupabaseCasesIntoCDM()`

## Casos

Objeto local central:
- `CDM`

Casos do laboratorio / fluxo clinico:
- ficam em `cases`
- arquivos ficam no Storage `case-files`
- metadados dos arquivos ficam em `case_files`
- mensagens ficam em `case_messages`
- avisos/status ficam em `pending_issues`

MyCases:
- casos manuais sao separados do MyLab/conversas
- casos vindos do MyLab so entram no MyCases depois que o dentista confirma recebimento
- apos confirmar recebimento, o caso deve sair do MyLab e ficar no MyCases

MyLab em todos os perfis:
- usa um portfolio visual limpo com cartoes compactos, estado em pill e progresso por etapas
- o progresso aparece como uma barra grossa de quatro segmentos, sem pontos; ela enche por etapa e usa a cor do estado atual
- no perfil de laboratorio mostra a clinica responsavel logo abaixo do paciente; no perfil de dentista/assistente mostra o laboratorio
- mostra tipo de trabalho, dentes e numero do caso na linha seguinte
- os cartoes continuam clicaveis; as acoes completas ficam no detalhe e respeitam as permissoes do perfil

## Notificacoes Push

- No iPhone/iPad, o service worker salva o destino do clique em IndexedDB antes de despertar a PWA. A app consome esse destino depois de restaurar a sessao e tambem ao voltar ao primeiro plano, evitando que o iOS abra somente a tela inicial quando descarta a query string da notificacao.
- Uma nova mudanca de estado sempre dispara notificacao, inclusive ao voltar para `Em Producao`. Se ja existir um aviso aberto igual, ele e reutilizado para nao duplicar a lista, mas isso nao bloqueia o novo push.

PWA basico ja implementado:
- `manifest.json`
- `sw.js`
- icones

Web Push implementado:
- tabela `push_subscriptions`
- Edge Function `send-push`
- Service Worker recebe push e abre a app

Chave publica VAPID esta em:
- `DENTALAB_VAPID_PUBLIC_KEY`

Chave privada VAPID fica somente nos Secrets do Supabase.
Nunca colocar private key no `index.html`.

Secrets esperados na Edge Function:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

O Supabase fornece automaticamente:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Push ja funciona para:
- mensagens
- novo caso
- status/avisos
- confirmacao de recebimento

Clique na notificacao:
- mensagens/casos abrem a conversa
- avisos abrem a aba Alertas

Politica de exibicao:
- alertas e casos novos geram aviso dentro da app quando ela estiver visivel
- mensagens de conversa nao geram toast/aviso branco dentro da app; a propria conversa mostra a mensagem recebida
- o badge Conversas conta IDs de mensagens realmente nao lidas, sem duplicar Realtime e polling
- abrir uma conversa marca como lidas apenas as mensagens daquela conversa; entrar apenas na lista Conversas nao zera o total
- fora da aba Conversas, uma nova mensagem faz o botao Conversas piscar e atualiza o badge
- no iPhone, o Service Worker consulta a propria pagina para saber a visibilidade e a animacao possui fallback WebKit/Web Animations
- no clique de Push, o Service Worker navega primeiro para a URL exata e so depois foca a PWA; isso evita perder o destino quando o iPhone estava suspenso
- alertas sempre mostram um aviso pequeno dentro da app; fora da aba Alertas, o botao Alertas tambem pisca sem mudar de aba automaticamente
- casos novos seguem o mesmo padrao na aba MyLab/Casos
- a notificacao do sistema so pode ser suprimida quando a app estiver visivel, focada e exatamente na conversa/aba de destino
- estar em MyCases, MyLab, Perfil ou noutra conversa nao suprime notificacao do sistema
- a inscricao push deve ser sincronizada ao entrar na app e periodicamente ao voltar ao primeiro plano

Funcoes importantes:
- `sendPushToUser()`
- `dentalabPushUrl()`
- `dentalabHandleNotificationOpen()`
- `cdmPushIssueToClinic()`
- `cdmPushReceiptConfirmedToLab()`

## STL Viewer

Viewer 3D e parte critica da app.
Muito cuidado para nao quebrar.

Funcoes importantes:
- `U3D_buildMeshFromBuffer()`
- `U3D_updateFileStatusLabels()`
- `openUniversal3DViewer` / funcoes U3D relacionadas

Regras atuais:
- suporta STL, PLY, OBJ
- PLY pode ter cor
- controles de movimento foram ajustados para PC e iPhone
- Maxila, Mandibula e Extra devem ter toggles independentes
- extra scanner nao pode esconder upper/lower
- todos os viewers devem manter a mesma logica de movimento

## Fluxo de status

Status:
- `st-p` = Recebido, azul
- `st-a` = Em Producao, amarelo
- `st-ok` = Pronto, verde
- `st-done` = Entregue, cinza
- `st-wait` = Aguardando Clinica / pendencia

Funcoes importantes:
- `cdmSetStatus()`
- `cdmNotifyDentistStatusChange()`
- `addPendingIssue()`
- `resolvePending()`
- `cdmConfirmarRecebimento()`

Fluxo esperado:
1. Dentista cria caso.
2. Laboratorio recebe no MyLab.
3. Laboratorio muda status.
4. Dentista recebe aviso.
5. Se status for Entregue, dentista precisa confirmar recebimento.
6. So depois da confirmacao o caso sai do MyLab e vai para MyCases.

## Alertas / pending issues

Tabela:
- `pending_issues`

Tipos principais:
- `scanner_corrompido`
- `scanner_incompleto`
- `falta_fotos`
- `falta_cor`
- `falta_material`
- `retificar_prazo`
- `confirmar_recebimento`
- `status_recebido`
- `status_producao`
- `status_pronto`

Deduplicacao e lembretes:
- existe apenas um aviso aberto por caso + tipo + target
- repetir a mesma solicitacao reutiliza o aviso aberto
- o botao Enviar lembrete dispara um novo Push para o dentista sem criar outro aviso
- SQL de garantia no banco: `dentalab_pending_issues_dedupe.sql`

Coluna importante:
- `target`

Se faltar no Supabase, rodar:

```sql
alter table pending_issues add column if not exists target text;
```

## Cuidados importantes

- Nao reintroduzir dados fake/demo para contas reais.
- Contas novas devem iniciar zeradas.
- MyCases manuais nao devem aparecer em conversas/MyLab.
- MyLab e conversas devem mostrar apenas casos compartilhados entre dentista/clinica e laboratorio.
- Arquivos importantes devem persistir no Supabase Storage, nao so localStorage.
- Nao quebrar STL Viewer ao mexer em casos, fotos ou storage.
- Toda mudanca em PWA/push precisa subir `index.html` e, quando mexer em Service Worker, tambem `sw.js`.

## Arquivos auxiliares criados localmente

SQL:
- `dentalab_push_subscriptions.sql`
- cria as politicas RLS por utilizador e a RPC segura `register_push_subscription`
- a RPC permite reassociar ao utilizador atual um endpoint que ficou ligado a uma sessao anterior no mesmo navegador

Edge Function:
- `supabase/functions/send-push/index.ts`

Guia:
- `dentalab_push_setup_README.txt`

## Estado atual

Funciona:
- login real
- perfis por role
- criacao de casos
- sincronizacao dentista/laboratorio
- upload de arquivos
- STL Viewer
- MyLab
- MyCases
- conversas
- status
- avisos
- confirmacao de recebimento
- PWA instalado
- notificacoes push em PC
- clique em notificacao abrindo app correta

Ainda recomendado testar/polir:
- push no iPhone quando o aparelho estiver carregado
- deduplicacao de notificacoes em todos os cenarios
- abrir detalhe exato do caso a partir de notificacao de alerta
- seguranca final da Edge Function antes de vender/apresentar formalmente
