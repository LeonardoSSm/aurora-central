# Relatório do Ciclo 01

Validação local em 25 de novembro de 2026, no escopo da [issue #2](https://github.com/LeonardoSSm/aurora-central/issues/2).

## Verificação local

Ambiente Windows 11 26H2 x64 (26300.9974), Node.js 24.15.0, npm 11.12.1, Rust 1.97.1, Tauri 2.12.7 e WebView2 158.0.4370.33.

| Verificação | Resultado |
| --- | --- |
| `npm ci` | Instalação limpa pelo lockfile |
| `npm run lint` | Aprovado |
| `npm run typecheck` | Aprovado |
| `npm test` | 6 testes aprovados, incluindo registry, feedback do launcher e amostragem 3D |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Aprovado |
| `npm run tauri build -- --no-bundle -- --locked` | Aprovado, executável de produção gerado e aberto |
| `cargo test --manifest-path src-tauri/Cargo.toml --release --locked --features tauri/custom-protocol` | 2 testes aprovados para a CSP e capability de produção |
| Smoke test na WebView do executável | Aprovado nos cenários abaixo |

## Evidência da aplicação

- [Janela nativa Windows](evidence/cycle-01/windows-home.jpg), captura da home com viewport de 1280 × 800 e escala 1×. O título pertence à janela do sistema.
- [Viewport de 480 × 640 emulada na WebView nativa](evidence/cycle-01/webview-480.png), com os quatro módulos cabendo na área visível e feedback do Lens.

O smoke test abriu o executável de produção, verificou a origem local e a presença da CSP, confirmou variação entre quadros do WebGL e acionou os quatro botões pelo DOM. Cada módulo retornou seu nome e a mensagem de abertura indisponível. Com movimento reduzido emulado, os desenhos WebGL recorrentes pararam. Ao simular perda de contexto, o fallback apareceu e a renderização retornou após restaurar o contexto. A janela padrão coube na viewport sem rolagem vertical. A viewport estreita acomodou os quatro módulos sem rolagem horizontal. O teste terminou sem erros inesperados de JavaScript ou de carregamento.

A referência oficial foi comparada com a execução nativa. A composição mantém fundo preto, assinatura superior, núcleo orgânico sem rosto e quatro cápsulas nas posições e cores correspondentes. A prévia usa traço orbital e luminosidade mais discretos que a imagem; as partículas e os detalhes da marca foram recriados em código. A aprovação visual definitiva do motor fica no Ciclo 02.

## Limites da validação

- A execução interativa foi verificada em Windows. O CI cobre build e testes em Windows e Ubuntu; execução interativa em Linux e macOS fica pendente.
- A árvore de acessibilidade do Windows expôs os quatro botões e a região de status. A checagem manual de Tab/Enter foi interrompida durante o controle da janela. O foco visível está definido em CSS e a home usa botões HTML nativos.
- A abertura dos aplicativos, integração nativa, persistência, perfis de GPU, múltiplos monitores e pacotes de distribuição pertencem aos ciclos do [roadmap](roadmap.md). O relatório não inclui benchmarks de desempenho nem validação de 4K ou múltiplas escalas DPI.

Para repetir a inspeção, rode os comandos do [README](../README.md), abra o binário de produção e acione cada módulo. Compare a home com a [referência visual](visual-identity.md) e reduza o tamanho da janela para inspecionar as cápsulas e a área ocupada pelo núcleo.
