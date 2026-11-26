# Ciclo 06 — Configurações persistentes e personalização

O painel **Configurações** fica no rodapé da home e reúne Geral, Aparência, Desempenho, Aplicativos, Monitores e Acessibilidade. O atalho **Aplicativos** abre diretamente a categoria. A prévia usa o canvas da home. **Fechar** ou Esc descarta o rascunho. **Restaurar padrões** prepara a restauração para conferência e **Aplicar** confirma a gravação. A demonstração do núcleo continua com ajustes de sessão. [Issue #7](https://github.com/LeonardoSSm/aurora-central/issues/7) · [Referência oficial](visual-identity.md)

## Schema v1

O Rust é a fonte de verdade do schema de `settings.json`, no diretório de configuração resolvido pelo Tauri. A WebView usa o contrato equivalente em TypeScript. Os objetos rejeitam campos extras e o arquivo tem limite de 128 KiB.

| Campo | Valores | Padrão |
| --- | --- | --- |
| `version` | Inteiro discriminador do schema | `1` |
| `initialView` | `central`, `immersive`, `ambiental` | `central` |
| `motion` | `system`, `reduced` | `system` |
| `graphics.profile` | `low`, `medium`, `high`, `ultra` | `medium` |
| `graphics.quality` | `standard`, `economy` (halo simplificado) | `standard` |
| `graphics.palette` | `aurora`, `nebula`, `ember`, `glacier` | `aurora` |
| `graphics.particleCount` | Nulo segue o perfil. Inteiro entre 5.000 e 100.000 sobrescreve a densidade. | Nulo (20.000 no perfil Médio) |
| `graphics.brightness` | Inteiro de 25 a 150% | 100% |
| `graphics.speed` | Inteiro de 25 a 175% | 100% |
| `graphics.fps` | 30, 45, 60, 90 ou 120 | 60 |
| `graphics.dpr` | 1, 1,25, 1,5 ou 2 | 1,5 |
| `graphics.resolution` | 50, 75 ou 100% da resolução após aplicar o DPR | 100% |
| `graphics.background` | `adaptive` (até 20 FPS), `pause` ou `continue` quando visível sem foco. Uma janela oculta pausa o desenho. | `adaptive` |
| `modules` | Preferências para `board`, `control`, `nexus` e `lens` | Quatro entradas |
| `modules.<id>.opening` | `launch-or-reuse`, `running-only` | `launch-or-reuse` |
| `modules.<id>.focusExisting` | Booleano | `true` |
| `modules.<id>.preferredMonitor` | ID hexadecimal minúsculo de 64 caracteres ou nulo. Control usa posicionamento próprio. | Nulo |

As alterações de visualização inicial entram em vigor ao remontar a home, inclusive ao reiniciar o aplicativo. Os modos existentes continuam acessíveis pelos atalhos. O movimento reduzido acompanha a preferência do sistema e pode ser forçado no painel. Ele pausa a animação do núcleo e remove o pulso e as transições orbitais.

## Settings Manager

- `settings_snapshot` retorna a configuração validada, o estado do armazenamento e uma revisão da sessão. `settings_save` recebe a revisão esperada e a configuração completa. Revisões obsoletas são recusadas. Os comandos são exclusivos da WebView local `main`.
- O Settings Manager e o launcher compartilham o mutex do estado desktop e o lock exclusivo do perfil. O mesmo lock protege a migração e mantém a exclusão mútua com versões anteriores. A rotina de disco compartilhada grava em arquivo temporário no mesmo diretório, sincroniza o conteúdo e o substitui atomicamente. Em Unix, tenta sincronizar o diretório. A revisão e o snapshot só mudam após o sucesso da substituição.
- Na ausência de `settings.json`, o migrador lê o monitor associado à autorização legada da plataforma em `launcher-v1.json` e grava as preferências migradas. Os IDs já salvos podem sobreviver à desconexão. Novas seleções exigem um monitor elegível no Windows. O arquivo legado continua legível durante atualizações.
- Conteúdo inválido é substituído por padrões validados e o painel informa a recuperação. Falha de acesso ou lock deixa a prévia disponível. Um arquivo legível que indica versão superior é preservado e o armazenamento fica em modo de leitura. Este é o primeiro schema próprio de preferências. Versões futuras podem acrescentar conversões no ponto de leitura, antes da validação do schema atual.
- O arquivo comum contém preferências. Autorizações continuam no registro nativo e passam pela seleção, confirmação e revalidação de arquivo do Ciclo 04. **Restaurar padrões** redefine preferências por módulo. **Remover** em Aplicativos revoga uma autorização específica. Novas preferências são consumidas nas aberturas seguintes. O registro nativo depende da fronteira de confiança do usuário local já documentada. Credenciais, tokens, áudio, transcrições e histórico ficam fora do schema. Credenciais de integrações futuras exigirão armazenamento seguro próprio. [Fronteiras IPC e privacidade](security.md)

## Renderização e compatibilidade

A prévia atualiza matrizes de paleta, uniformes, faixa de desenho e tamanho do buffer no renderizador existente. A geometria mantém 100.000 posições determinísticas em um único buffer. O perfil muda quantas posições são submetidas. O tamanho do buffer é limitado a 4.096 pixels por eixo e 8.388.608 pixels no total. Perfil, qualidade, movimentos e cadência podem ser testados sem fechar o painel. O runtime desfaz observadores, listeners e recursos Three.js ao desmontar o núcleo.

O Windows aplica as preferências de foco e de monitor quando existe uma janela elegível. O Linux usa a descoberta de processos existente. O gerenciamento de posição e foco continua sob responsabilidade do ambiente gráfico nessas sessões. A versão web permite prévia e aplicação durante a sessão. [Integração por plataforma](application-integration.md)

## Verificação e evidências

Validação local em 26 de novembro de 2026 no Windows 11 26H2 (26300.9974), Node.js 24.15.0, Rust 1.97.1 e WebView2 158.0.4370.33.

| Comando | Resultado local |
| --- | --- |
| `npm ci --offline` | Dependências instaladas do cache pelo lockfile. |
| `npm run lint` e `npm run typecheck` | Aprovados. |
| `npm test` | 38 testes passaram, incluindo cadência em segundo plano e limites de renderização. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Aprovado. |
| `npm run tauri build -- --no-bundle -- --locked` | Binário Windows de produção gerado. O Vite emitiu o aviso de chunk acima de 500 kB. |
| `cargo test --manifest-path src-tauri/Cargo.toml --release --locked --features tauri/custom-protocol` | 17 testes Windows, incluindo migração, restauração, corrupção, conflitos de revisão, falha de escrita e ACL. |
| `node scripts/smoke-settings.mjs 9236 <fase>` | WebView2 nativa em três processos sucessivos. Prévia, gravação, reinício, restauração e recuperação. |
| `node scripts/smoke-conversation.mjs 9236 <diretório>` | Regressão do Ciclo 05 exercitada na WebView2 de produção nas duas viewports. [Resultado](evidence/cycle-06/webview2-conversation.json) |

A matriz do PR roda lint, typecheck, testes JavaScript e Rust, rustfmt e build desktop em Windows 2025 e Ubuntu 24.04. [Verificações do PR #14](https://github.com/LeonardoSSm/aurora-central/pull/14/checks)

Na comparação com a referência, a home padrão conserva a assinatura Aurora no topo, as quatro cápsulas nas posições da órbita, o fundo escuro e o volume sem rosto em azul, violeta, magenta e coral. A prévia glacial mantém a mesma geometria e muda a cor do núcleo. Na viewport de 480 × 560, o painel inferior preserva uma faixa da prévia e permite rolar os controles com os botões de ação à vista. [Home padrão](evidence/cycle-06/home-windows.jpg) · [Prévia de aparência](evidence/cycle-06/aparencia-windows.jpg) · [Janela de 480 × 560](evidence/cycle-06/desempenho-480-windows.jpg)

O ensaio alternou entre os quatro perfis 32 vezes. A WebView2 submeteu as densidades esperadas e manteve um único contexto ativo, sem perda de contexto ou novas chamadas de criação de buffers, programas, texturas e framebuffers observadas durante as trocas. A resolução de 50% com DPR 2 reduziu o buffer de 867 × 867 a 578 × 578 na viewport lógica de 1280 × 800, e a densidade foi ajustada para 37.000 partículas. O teste coletou métricas do heap JavaScript antes e depois das trocas, sempre após uma coleta de lixo. Os contadores mostram chamadas WebGL e memória da WebView2. A memória física da GPU e o consumo de longo prazo ficaram fora dessa medição. [Métricas e contadores](evidence/cycle-06/webview2-exercise.json)

Esc fechou a prévia de aparência, descartou a edição e devolveu o foco ao botão **Configurações**. Após reiniciar a aplicação, o modo inicial Imersivo, a paleta, o movimento reduzido, a densidade e as preferências de abertura e monitor voltaram. O ensaio aplicou os padrões, encerrou a janela, truncou o arquivo do perfil de teste e abriu um terceiro processo para verificar o aviso e a correção do arquivo. O teste Rust de migração verificou que a autorização legada continua válida após restauração de preferências. [Aplicativos](evidence/cycle-06/aplicativos-windows.jpg) · [Monitores](evidence/cycle-06/monitores-windows.jpg) · [Reinício](evidence/cycle-06/imersivo-reinicio-windows.jpg) · [Recuperação](evidence/cycle-06/recuperacao-windows.jpg)

Para reproduzir, gere um build de produção com um identificador Tauri exclusivo para o perfil de teste. Abra o binário com `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9236` e `WEBVIEW2_USER_DATA_FOLDER` apontando a um diretório dedicado. Rode o script com `exercise`, encerre e reabra o binário e rode `restart`. Encerre a aplicação novamente, trunque apenas o `settings.json` do perfil de teste e rode `recover` após a terceira abertura. A fase `exercise` usa ao menos um monitor com ID estável.

## Limites

- O ensaio visual utilizou Windows com uma única tela física e viewports emuladas de 1280 × 800 e 480 × 560. O Ubuntu é coberto por build e testes no CI. A validação visual nativa no Linux e o teste de desconexão física de monitores seguem pendentes.
- A renderização usa o limite configurado, a taxa disponível da WebView e a política da janela. A medição de recursos corresponde às trocas instrumentadas nesse equipamento.
