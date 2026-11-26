# Ciclo 05 — Inteligência Aurora

Implementação da issue #6 a partir de `5d655e5`, merge do Ciclo 04. A conversa é opcional e começa recolhida no modo Central. O núcleo continua renderizado em WebGL 2 e mantém a órbita, os controles, a tela cheia e a demonstração gráfica. [Issue #6](https://github.com/LeonardoSSm/aurora-central/issues/6) · [Identidade visual](visual-identity.md)

## Responsabilidades

| Componente | Responsabilidade |
| --- | --- |
| Aurora Central | Interação, captura e apresentação, encaminhamento, estado visual e confirmação de ações |
| Aurora AI | Modelos, inferência, agentes, skills e orquestração |
| Aurora Nexus | Memória, conhecimento, RAG e contexto |
| Aurora Flow | Workflows e automações |
| Aurora Control | Monitoramento e observabilidade |

Board, Control, Lens e Nexus mantêm sua independência. O registro de módulos fornece IDs e a abertura aprovada segue pelo launcher nativo. O provedor instalado no Central é determinístico e identificado como **Simulação local**. A versão inclui portas para serviços futuros, sem clientes de rede, credenciais, armazenamento conversacional ou alterações em outros repositórios.

## Contratos

| Porta | Entrada e saída |
| --- | --- |
| `LocalAssistantProvider` e `ExternalAssistantProvider` | `availability(operation)` e `stream(request, operation)`. O pedido tem texto, origem (`text`, `voice` ou `voice-simulation`), idioma e referências opcionais de contexto. O fluxo entrega `text.delta` e até uma `command.proposed`. |
| `NexusContextProvider` | `availability(operation)` e `resolve({ query, locale }, operation)`. A saída são referências opacas com ID e rótulo. A versão atual não consulta essa porta nem inclui contexto no pedido. |
| `SpeechToText` | `transcribe(operation)` entrega a transcrição final em uma promessa. Pode emitir `transcript.partial` e `audio.level`. A transcrição termina no campo editável e exige envio pelo usuário. |
| `TextToSpeech` | `speak(text, operation)` termina quando a reprodução acaba. Pode emitir `speech.started` e `audio.level`. O adaptador local emite o início real da reprodução. A síntese da Web Speech API não expõe amostras de áudio. |

As operações incluem `requestId` e `AbortSignal`. Adaptadores futuros devem cancelar conexões, streams e mídia ao receber o sinal. O Central descarta resultados tardios, fecha o iterador quando interrompido e limita o texto de entrada, a resposta e o número de eventos por turno. A sessão mantém em memória apenas as mensagens recentes enquanto a conversa está aberta. Cada resposta recebe a mensagem atual. O histórico da interface permanece local.

O núcleo parte de `idle`, passa a `listening` na tentativa de captura e a `thinking` durante a resposta. `speaking` acompanha o início efetivo da reprodução, `executing` acompanha o comando e `success` ou `error` expressam o resultado. Uma proposta sensível em espera mostra o alvo da confirmação enquanto o núcleo volta a `idle`. **Repousar** e **Acordar** controlam `sleep`. Quando o microfone fornece amostras, o nível RMS normalizado alimenta o mesmo parâmetro de amplitude do núcleo. A preferência por movimento reduzido continua aplicada.

## Permissões, falhas e cancelamento

| Comando | Permissão | Execução |
| --- | --- | --- |
| `module.describe` | `modules:read` | Exibe uma descrição local do módulo registrado. |
| `module.open` | `modules:open` | Requer autorização explícita para o alvo exibido e invoca o launcher desktop. |

A lista de permissões vem da composição do Central. O registro valida a forma exata da proposta e os IDs de Board, Control, Nexus ou Lens. A execução só começa após o fechamento válido do stream. A confirmação é vinculada à solicitação, expira em 30 s e libera uma única execução. A autorização existente do executável permanece no launcher Rust. Depois do envio ao IPC, o cancelamento suspende a observação. O launcher pode concluir o pedido aprovado e o processo mantém seu ciclo normal. [Segurança e IPC](security.md)

Há uma operação ativa por vez. Cancelar, fechar a conversa, mudar de modo ou sair da home encerra a operação corrente. Ocultar a página cancela a captura e as solicitações com leitura em voz alta, inclusive quando a reprodução ainda está pendente. O reconhecimento exige suporte local para `pt-BR` antes de abrir o microfone, sem instalação automática de pacote de idioma. Se a permissão de captura chegar após o cancelamento, as faixas são encerradas assim que chegam. A síntese usa uma voz do dispositivo em português. A escrita e a amostra de transcrição ficam disponíveis sem serviços de voz. [Web Speech API](https://webaudio.github.io/web-speech-api/)

## Verificação e evidências

Validação local em 26 de novembro de 2026 no Windows 11 26H2 (26300.9974), Node.js 24.15.0, Rust 1.97.1 e WebView2 158.0.4370.33.

| Comando | Resultado local |
| --- | --- |
| `npm ci --offline` | Dependências reinstaladas do cache pelo lockfile. |
| `npm run lint` e `npm run typecheck` | Aprovados. |
| `npm test` | 36 testes passaram, incluindo integração entre sessão, registro, voz e launcher. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Aprovado. |
| `npm run tauri build -- --no-bundle -- --locked` | Executável Windows de produção gerado. O Vite emitiu o aviso de chunk acima de 500 kB. |
| `cargo test --manifest-path src-tauri/Cargo.toml --release --locked --features tauri/custom-protocol` | 10 testes passaram, incluindo ACL local, CSP e validação dos pedidos IPC. |
| `node scripts/smoke-conversation.mjs 9235` | Fluxos exercitados na WebView2 de produção, em 1280 × 800 e 480 × 560. |

Os testes cobrem os oito estados, transcrição sem envio automático, indisponibilidade, propostas inválidas, permissões, aprovação expirada ou repetida, concorrência, cancelamento e liberação de recursos. A matriz de CI roda os comandos do README em Windows 2025 e Ubuntu 24.04. [Execuções do CI na branch](https://github.com/LeonardoSSm/aurora-central/actions/workflows/ci.yml?query=branch%3Aciclo-05%2Finteligencia-aurora)

Na comparação com a referência oficial, a home recolhida conserva o fundo escuro, a marca superior, o núcleo volumétrico sem rosto e a distribuição das quatro cápsulas. A conversa aberta usa o espaço entre a cena e o rodapé. Em 480 × 560 os quatro módulos e os controles permanecem visíveis.

O smoke test verificou os deltas da resposta, a revisão do rascunho simulado, cancelamento, repouso, recusa da abertura, rejeição de um clique sintético e confirmação por clique da WebView2. A confirmação chegou ao launcher Rust e retornou a ausência de executável configurado para Board. A WebView2 registrou o reconhecimento local `pt-BR` como indisponível. A leitura em voz alta entrou em `speaking` e concluiu com uma voz local `pt-BR`. [Dados da WebView2](evidence/cycle-05/validacao-webview.json)

- [Home recolhida](evidence/cycle-05/home-windows.jpg) e [conversa aberta](evidence/cycle-05/conversa-windows.jpg).
- [Confirmação de abertura](evidence/cycle-05/confirmacao-windows.jpg) e [viewport 480 × 560](evidence/cycle-05/conversa-480-windows.jpg).
- [Núcleo durante a síntese local](evidence/cycle-05/falando-windows.jpg).

Para reproduzir, execute o binário de produção com `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9235` e `WEBVIEW2_USER_DATA_FOLDER` apontando para um perfil de teste fora de `dist`. Use uma instalação de teste com pelo menos um módulo sem executável configurado. Rode o script e encerre a instância de teste ao terminar.

## Pendências

- Adaptadores reais de Aurora AI, Nexus, Flow e demais aplicativos dependem de contratos publicados por seus responsáveis. O Central já fornece os pontos de extensão para assistente e contexto. O launcher atual fornece a entrada tipada para os quatro módulos.
- A disponibilidade de voz depende da implementação da Web Speech API, do sistema operacional e dos idiomas instalados. A síntese do sistema não fornece amplitude ao adaptador. Uma futura implementação que exponha áudio poderá fornecer níveis reais pelo mesmo contrato.
- A captura e o RMS físicos em `pt-BR` não puderam ser exercitados nesta WebView2. O teste do adaptador com entradas controladas cobre o início local, o resultado e o encerramento do microfone. A inspeção interativa deste ciclo ocorreu apenas no Windows.
- A revisão de código e segurança ocorre no PR. O Ciclo 06 segue fora desta entrega.
