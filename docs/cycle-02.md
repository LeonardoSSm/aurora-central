# Relatório do Ciclo 02

Implementação da [issue #3](https://github.com/LeonardoSSm/aurora-central/issues/3) em 25 de novembro de 2026. A branch `ciclo-02/nucleo-aurora` parte do merge `af6f050` do [PR #9](https://github.com/LeonardoSSm/aurora-central/pull/9). A arquitetura e os estados estão descritos no [motor gráfico](graphics-engine.md).

O encerramento do Ciclo 01 confirmou o CI nas duas plataformas e a revisão automática sem apontamentos em `b5495b8`. Lint, typecheck e os oito testes JS/Rust passaram novamente no Windows. A repetição do build desktop local ficou bloqueada por uma instância antiga mantendo o executável aberto e por uma falha intermitente do linker MSVC. A validação de build do PR #9 foi a da [execução no GitHub Actions](https://github.com/LeonardoSSm/aurora-central/actions/runs/45671139788).

## Comparação visual

A [referência oficial](visual-identity.md) tem o núcleo como ponto focal, com faixas de luz sobre dobras, coral na frente e à direita, violeta e azul na base e espaço para a marca e os atalhos. Comparei esses elementos com a execução na WebView2 do aplicativo desktop.

A primeira execução mostrou profundidade e rotação, com cristas pouco luminosas. A segunda versão estreitou a camada externa de 5 mil partículas, manteve partículas no interior, destacou as cristas e introduziu um foco coral em movimento na frente. Em alguns quadros, o contorno ainda se aproximava da marca. Reduzi a área de projeção e concentrei a luz frontal no terceiro ajuste. O traço da órbita perde intensidade ao passar atrás da nuvem. A aprovação visual do proprietário continua pendente.

As capturas foram feitas na WebView2 do binário de produção. A gravação mostra o canvas durante as seleções sucessivas na demonstração.

- [Home do Windows, 1280 × 800](evidence/cycle-02/windows-home.jpg) e [viewport 480 × 640 emulada, após acionar Lens](evidence/cycle-02/webview-480.jpg).
- [Gravação das transições](evidence/cycle-02/transicoes.mp4), com cerca de 14 s a 30 FPS, na sequência `idle → listening → thinking → speaking → executing → success → error → sleep`. `speaking` recebeu amplitude de teste de 0,65.
- [Idle](evidence/cycle-02/state-idle.jpg), [Listening](evidence/cycle-02/state-listening.jpg), [Thinking](evidence/cycle-02/state-thinking.jpg) e [Speaking](evidence/cycle-02/state-speaking.jpg).
- [Executing](evidence/cycle-02/state-executing.jpg), [Success](evidence/cycle-02/state-success.jpg), [Error](evidence/cycle-02/state-error.jpg) e [Sleep](evidence/cycle-02/state-sleep.jpg).

## Perfis e medição

Ambiente Windows 11 26H2 x64 (26300.9974), Intel Core i5-1135G7, 16 GB de RAM, Intel Iris Xe Graphics e WebView2 158.0.4370.33 com ANGLE e Direct3D 11.

O protótipo com os quatro perfis limitados a 60 FPS chegou a 59,98–60,01 FPS na viewport CSS 1280 × 800 com escala 2× emulada. O Ultra, com limite de DPR 1,5×, submeteu 100 mil pontos em um buffer de 915 × 915 e registrou p95 de GPU de 0,65 ms para o desenho. O resultado permitiu testar DPR 2× no Ultra. O perfil padrão segue Médio para equilibrar densidade e custo.

O script `scripts/benchmark-core.mjs` mede o intervalo entre chamadas `POINTS` da WebView de produção via CDP. Uma segunda janela de amostragem mede o tempo de desenho na GPU quando `EXT_disjoint_timer_query_webgl2` está disponível. Os tempos de CPU são a soma dos processos da WebView por segundo durante a janela principal. Incluem trabalho alheio ao desenho, como composição. A leitura de GPU cobre a chamada de desenho. Não houve acesso a uma medição de potência em watts.

Na versão com a iluminação refinada, medi seis segundos por perfil, seguidos de 1,1 segundo para os tempos de GPU. Usei a tela de demonstração em `idle`, com viewport CSS de 1280 × 800 e limite de 60 FPS. O p50 dos intervalos foi de 16,7 ms em todas as amostras.

| Escala da WebView | Perfil | Partículas | Buffer | FPS | p95 entre quadros (ms) | p95 de GPU (ms) | CPU (ms/s) |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
| 1× nativa | Baixo | 5.000 | 610 × 610 | 59,99 | 16,9 | 0,08 | 159 |
| 1× nativa | Médio | 20.000 | 610 × 610 | 60,00 | 16,9 | 0,16 | 156 |
| 1× nativa | Alto | 50.000 | 610 × 610 | 59,99 | 16,9 | 0,35 | 173 |
| 1× nativa | Ultra | 100.000 | 610 × 610 | 60,00 | 17,0 | 0,59 | 160 |
| 2× emulada | Baixo | 5.000 | 610 × 610 | 59,99 | 16,9 | 0,06 | 163 |
| 2× emulada | Médio | 20.000 | 915 × 915 | 59,99 | 16,9 | 0,17 | 163 |
| 2× emulada | Alto | 50.000 | 915 × 915 | 60,00 | 16,9 | 1,93 | 162 |
| 2× emulada | Ultra | 100.000 | 1220 × 1220 | 60,00 | 17,0 | 0,70 | 174 |

O p95 de GPU oscilou entre perfis na escala emulada. As janelas são curtas e representam uma sessão, com o custo de fragmentos também dependente do tamanho e da sobreposição dos pontos. O Ultra ficou no limite de cadência com DPR 2×, que passou a ser o padrão desse perfil. Os limites de DPR são 1× no Baixo e 1,5× no Médio e no Alto. [Dados a 1×](evidence/cycle-02/benchmark-dpr-1.jsonl) · [Dados a 2×](evidence/cycle-02/benchmark-dpr-2.jsonl)

Para repetir a medição, compile o [binário de produção](../README.md#verificação-e-build) e abra uma instância exclusiva em primeiro plano no Windows. As variáveis habilitam a depuração apenas no processo iniciado para a medição.

```powershell
$env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $env:TEMP 'aurora-central-benchmark'
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9228'
Start-Process -FilePath (Resolve-Path 'src-tauri/target/release/aurora-central.exe')
node scripts/benchmark-core.mjs 9228 6000
node scripts/benchmark-core.mjs 9228 6000 2
Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS, Env:WEBVIEW2_USER_DATA_FOLDER
```

## Verificação do binário

| Comando | Resultado local |
| --- | --- |
| `npm ci` | Instalação pelo lockfile concluída |
| `npm run lint` e `npm run typecheck` | Aprovados |
| `npm test` | 12 testes aprovados |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Aprovado |
| `npm run tauri build -- --no-bundle -- --locked` | Binário Windows de produção gerado |
| `cargo test --manifest-path src-tauri/Cargo.toml --release --locked --features tauri/custom-protocol` | 2 testes de segurança aprovados |

No binário, a navegação com Tab e Enter acionou Board, Control, Nexus e Lens e preservou o feedback de indisponibilidade. A emulação de 480 × 640 manteve os quatro botões dentro da viewport sem rolagem horizontal. A preferência por movimento reduzido produziu quadros idênticos. Uma perda induzida via `WEBGL_lose_context` mostrou o aviso e a restauração retomou o movimento. A demonstração foi aberta com os oito estados e as escolhas de perfil, FPS e DPR persistiram ao retornar à home e abrir a demonstração de novo. O console ficou livre de erros inesperados.

A validação adicional cobriu a perda de contexto com movimento reduzido. O redesenho espera o Three.js reconstruir o estado WebGL. O binário corrigido desenhou a pose recuperada e a manteve estática. A contagem observada foi de 60 desenhos/s com o limite padrão, 30 com o limite de 30 FPS, 20 em `sleep` e zero com a visibilidade da página marcada como oculta durante o teste.

## Limites da validação

- Execução interativa e medições feitas em um único Windows com Iris Xe. Linux e macOS aguardam inspeção em execução, e a escala 2× foi emulada na WebView.
- A fluidez depende do driver, da taxa de atualização e da disponibilidade de WebGL 2. O aplicativo mantém os atalhos acessíveis quando o núcleo fica indisponível.
- O Vite registrou o aviso de chunk maior que 500 kB. A saída JavaScript principal tem 761,49 kB minificados e 205,81 kB com gzip. Os arquivos são incorporados ao binário desktop.
