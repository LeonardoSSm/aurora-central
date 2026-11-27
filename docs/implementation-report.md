# Fechamento técnico da v0.1.0

O Ciclo 07 consolida a `main` de `d0fd9ff`, que integra os seis ciclos de implementação. A candidata distribui o desktop Windows x64. [Issue #8](https://github.com/LeonardoSSm/aurora-central/issues/8) · [Changelog](../CHANGELOG.md)

## Integridade das entregas

| Ciclo | Entrega verificada | Evidência anterior |
| --- | --- | --- |
| 01 | Shell Tauri, fluxo de build, contratos e documentação de arquitetura | [Relatório](cycle-01.md) |
| 02 | Núcleo de partículas WebGL 2, oito estados e perfis | [Relatório](cycle-02.md) |
| 03 | Órbita dos quatro módulos, navegação por teclado, modos e tela cheia | [Relatório](cycle-03.md) |
| 04 | Autorização de executável, descoberta de processo, foco e preferência de monitor | [Relatório](cycle-04.md) |
| 05 | Conversa local, confirmação de abertura, privacidade e portas para assistente e contexto | [Relatório](cycle-05.md) |
| 06 | Configurações versionadas, prévia WebGL, migração, recuperação e limites gráficos | [Relatório](cycle-06.md) |

As portas de Aurora AI e Aurora Nexus continuam disponíveis no código. A conversa permanece identificada como **Simulação local**. Os quatro módulos são alvos independentes do launcher e dependem da disponibilidade e da autorização de seus respectivos executáveis. [Contratos e fronteiras](architecture.md) · [Integração por módulo](application-integration.md)

## Auditoria e testes

| Verificação | Resultado local |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm test` | Lint e tipos aprovados. 38 testes TypeScript. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Aprovado. |
| `cargo test --manifest-path src-tauri/Cargo.toml --release --locked --offline --features tauri/custom-protocol` | 17 testes Windows, incluindo ACL, CSP, launcher e preferências. |
| `npm run tauri build -- --bundles nsis --no-binary-patching -- --locked --offline` | Instalador NSIS x64 gerado. O Vite sinalizou o chunk JavaScript de 820 kB. |
| `scripts/test-windows-installer.ps1` | Instalação no perfil do usuário, SHA-256 do binário instalado e remoção do binário e da entrada de instalação. |
| `npm audit --audit-level=high` | O npm reportou zero vulnerabilidades. |
| `cargo audit --file src-tauri/Cargo.lock` | 441 dependências verificadas e três avisos transitivos detalhados abaixo. |

A revisão da composição local conferiu a CSP, as capabilities, o allowlist IPC e a ausência de serviços externos na conversa. O launcher continua exigindo aprovação nativa e revalidação do binário. Os testes cobrem solicitações malformadas, isolamento por janela e origem, conflitos de revisão, falha de gravação e preservação da autorização ao restaurar padrões. A sessão de voz mantém texto e áudio em memória e usa serviços locais quando disponíveis. [Modelo de segurança](security.md)

A minimização nativa mantinha a WebView2 visível para a página. O host Rust agora sincroniza a visibilidade da WebView2 na minimização e na restauração da janela principal. Isso reaproveita a pausa de desenho e o cancelamento de voz já vinculados à visibilidade. A mudança usa a API nativa e preserva a ACL e os contratos IPC. [Visibilidade do controlador WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2controller#put_isvisible)

Quando o contexto WebGL era perdido, a WebView2 exibia um retângulo branco atrás da mensagem de recuperação. O canvas agora fica invisível durante o fallback e mantém suas dimensões para a retomada do desenho.

- `chrono` 0.4.45 e `proc-macro-error` 1.0.4 são transitivos. O RustSec relata falta de manutenção e não fornece uma atualização corretiva. A árvore do alvo Windows x64 consultada não inclui os dois crates. [RUSTSEC-2026-0543](https://rustsec.org/advisories/RUSTSEC-2026-0543) · [RUSTSEC-2024-0370](https://rustsec.org/advisories/RUSTSEC-2024-0370)
- `glib` 0.18.5 é transitivo da pilha GTK/WebKitGTK do Linux e não compõe o pacote Windows x64. O RustSec aponta um problema em iteradores de `VariantStrIter`, corrigido em 0.20. O aplicativo não usa esse iterador diretamente. Atualizar a pilha GTK/WebKitGTK permanece pendente antes de uma distribuição Linux. [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429)

## Validação nativa no Windows

Os testes usaram Windows 11, Intel Iris Xe (ANGLE D3D11), Node.js 24.15.0, Rust 1.97.1 e WebView2 158.0.4370.33. O instalador foi verificado com a identidade de produção. Os testes interativos usaram uma compilação de produção com identificador separado para isolar as configurações locais.

- `node scripts/smoke-settings.mjs <porta> <fase> <destino>` passou nas fases `exercise`, `restart` e `recover` em processos sucessivos. Exercitou as seis categorias, 32 trocas de perfil sem novas alocações WebGL nos contadores monitorados, resolução/DPR, movimento reduzido, modo inicial, preferência de monitor, restauração e recuperação de um arquivo truncado. [Trocas e alocações](evidence/release-v0.1.0/webview2-exercise.json) · [Reinício](evidence/release-v0.1.0/webview2-restart.json) · [Recuperação](evidence/release-v0.1.0/webview2-recover.json)
- `node scripts/smoke-conversation.mjs <porta> <destino>` passou em 1280 × 800 e 480 × 560. Conferiu a simulação de transcrição, cancelamento, repouso, rejeição de confirmação sintética e o resultado de uma abertura aprovada no launcher para um módulo sem executável. O reconhecimento local estava indisponível. A leitura concluiu com uma voz local `pt-BR`. [Resultados da conversa](evidence/release-v0.1.0/validacao-webview.json)
- A captura foi comparada com a referência oficial e com a entrega do Ciclo 06. A composição mantém o fundo escuro, a assinatura, o núcleo volumétrico sem rosto e as quatro cápsulas orbitais. Os controles permanecem no rodapé. [Referência visual](visual-identity.md) · [Captura da candidata](evidence/release-v0.1.0/home-windows.jpg) · [Configurações em 480 × 560](evidence/release-v0.1.0/desempenho-480-windows.jpg)

As medidas de CPU agregam os subprocessos da WebView2 e são apresentadas em milissegundos de CPU por segundo. FPS e p95 são observados nas chamadas de desenho de partículas. A minimização foi confirmada pelo Windows. Antes da correção, a página permaneceu visível e fez 80 desenhos em cerca de 4 s. [Dados anteriores à correção](evidence/release-v0.1.0/native-runtime-before.json)

| Cenário na home | FPS | p95 entre desenhos | CPU WebView2 |
| --- | ---: | ---: | ---: |
| Interação com a órbita | 58,58 | 17,3 ms | 557 ms/s |
| Visível após 45 s sem interação | 30,12 | 33,8 ms | 221 ms/s |
| Janela minimizada | 0 | — | 18 ms/s |
| Janela restaurada | 59,47 | 16,9 ms | 210 ms/s |
| Após restaurar o contexto WebGL | 58,94 | 17,2 ms | 307 ms/s |

Induzi perda de contexto com `WEBGL_lose_context` e confirmei que a mensagem de recuperação preserva o fundo escuro. O canvas voltou a desenhar depois da restauração. O ensaio `node scripts/benchmark-core.mjs <porta> 4000 2` verificou os quatro perfis em DPR 2 emulado, com amostras de tempo de GPU. Parte da medição ocorreu em paralelo com compilação Rust no host. [Dados da candidata](evidence/release-v0.1.0/native-runtime.json) · [Fallback visual](evidence/release-v0.1.0/context-fallback-windows.jpg) · [Quatro perfis](evidence/release-v0.1.0/profiles-dpr-2.jsonl)

O ensaio local usou uma tela física, viewports e DPR emulados e cerca de um minuto de execução monitorada por passagem. Testes de longa duração, múltiplos monitores físicos, memória de GPU, WebView2 a instalar do zero e execução gráfica nativa no Linux permanecem pendentes. O destino Linux é verificado com build e testes no runner Ubuntu. [CI](https://github.com/LeonardoSSm/aurora-central/actions/workflows/ci.yml)

## Empacotamento e publicação

O override `tauri.windows.conf.json` configura NSIS por usuário e o bootstrapper oficial do WebView2 para máquinas sem runtime. O identificador do aplicativo conserva o diretório de configuração. O build usa `--no-binary-patching` porque distribui um único formato e o teste compara o SHA-256 do executável instalado com o binário compilado. O CI testa instalação e desinstalação em um runner limpo e guarda o instalador e `SHA256SUMS.txt` como artefato de revisão. [Tauri](https://v2.tauri.app/distribute/windows-installer/) · [Workflow](../.github/workflows/ci.yml)

O teste local executou o instalador em um diretório temporário, verificou a entrada de instalação por usuário e a cópia byte a byte do executável, e removeu a cópia pelo desinstalador fornecido. O manifesto registra o hash do pacote gerado nesta sessão. [Dados do instalador local](evidence/release-v0.1.0/windows-installer.json)

Depois da aprovação do PR e do CI na `main`, a publicação deve usar o artefato do commit aprovado e uma tag `v0.1.0` apontando para esse commit. Anexe o instalador e o manifesto SHA-256 à release com as notas do changelog. O fluxo do PR tem permissão de leitura e gera somente artefatos de revisão. A candidata gerada localmente não tem assinatura Authenticode. [Changelog](../CHANGELOG.md) · [Instalação e limitações](../README.md)
