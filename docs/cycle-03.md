# Relatório do Ciclo 03

Implementação da [issue #4](https://github.com/LeonardoSSm/aurora-central/issues/4) em 25 de novembro de 2026. A branch `ciclo-03/interface-orbital` parte do merge `b4269f3` do [PR #10](https://github.com/LeonardoSSm/aurora-central/pull/10). O proprietário autorizou o avanço após interagir com o binário do Ciclo 02.

## Interface e decisões

Mantive o motor do Ciclo 02 e a composição da [referência oficial](visual-identity.md). Na WebView2, comparei a marca no topo, os pares de cápsulas nas posições e cores correspondentes, o espaço negativo e o volume sem rosto. Os traços são discretos em repouso e ficam iluminados na direção da cápsula em foco. A luminosidade do núcleo continua abaixo da imagem estática de referência em alguns quadros. Mantive a curva de luz e a distribuição do motor já entregue.

Os arcos frontal e traseiro são projeções da mesma órbita. Seus pontos posicionam as cápsulas e orientam um vetor amortecido no shader do núcleo. As camadas vetoriais são decorativas e não interceptam ações. Os botões conservam a posição durante hover, foco e seleção. Os registros de módulos guardam os metadados de apresentação e abertura.

A seleção usa 540 ms para a mudança de comportamento do núcleo e o pulso na conexão. Em seguida, o launcher retorna `unavailable` para os quatro módulos. Cliques repetidos durante a abertura são agrupados. Outra seleção, Esc ou uma troca de modo cancela a transição pendente. Movimento reduzido mantém o núcleo estático e publica o resultado sem atraso de animação. Os contratos de comando, cancelamento e resultado deixam a abertura nativa para o [Ciclo 04](roadmap.md).

Central mostra marca, órbita, módulos e controles. Imersivo atenua a órbita e os módulos e mantém a ação de retorno. Ambiental remove marca e órbita, mantém o núcleo sobre preto puro e revela o botão de retorno por interação. Tela cheia usa a janela nativa no Tauri. O modo Ambiental existe dentro da janela da aplicação.

## Evidências

- [Central na WebView2 do Windows](evidence/cycle-03/windows-central.jpg), [tela cheia nativa de 1920 × 1080](evidence/cycle-03/windows-tela-cheia.jpg), [janela nativa redimensionada para 808 × 605 úteis](evidence/cycle-03/windows-redimensionado.jpg) e [foco com Tab](evidence/cycle-03/foco-teclado.jpg).
- [Hover Board](evidence/cycle-03/hover-board.jpg), [Control](evidence/cycle-03/hover-control.jpg), [Nexus](evidence/cycle-03/hover-nexus.jpg) e [Lens](evidence/cycle-03/hover-lens.jpg).
- [Imersivo](evidence/cycle-03/modo-imersivo.jpg) e [Ambiental](evidence/cycle-03/modo-ambiental.jpg), após recolher o controle de retorno.
- [Janela mínima](evidence/cycle-03/janela-minima.jpg), [Full HD](evidence/cycle-03/full-hd.jpg), [QHD](evidence/cycle-03/qhd.jpg), [4K](evidence/cycle-03/4k.jpg) e [ultrawide](evidence/cycle-03/ultrawide.jpg), emulados na WebView2 do binário de produção.
- [Gravação das interações](evidence/cycle-03/interacoes.mp4), 13 s a 30 FPS, com os quatro hovers, seleção, substituição rápida e alternância entre os modos. [Quadro do pulso de seleção](evidence/cycle-03/pulso-selecao.jpg)

## Verificação local

| Comando | Resultado |
| --- | --- |
| `npm ci` | Instalação pelo lockfile concluída |
| `npm run lint` e `npm run typecheck` | Aprovados |
| `npm test` | 16 testes aprovados, incluindo 4 de concorrência e recuperação da seleção |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Aprovado |
| `npm run tauri build -- --no-bundle -- --locked` | Binário Windows de produção gerado |
| `cargo test --manifest-path src-tauri/Cargo.toml --release --locked --features tauri/custom-protocol` | 2 testes aprovados para CSP e capability |

Na primeira inspeção, a CSP obrigava o Tauri a usar seu transporte de fallback. Ajustei `connect-src` para permitir apenas os endereços internos do Tauri e mantive a capability limitada à tela cheia. Consultar a preferência de movimento durante o desenho podia congelar o último quadro animado na WebView2. O runtime agora redesenha a pose estática ao receber o evento de mudança.

Na WebView2 158.0.4370.33, Tab percorreu os quatro módulos com foco visível, e Enter e Espaço produziram o feedback de indisponibilidade. O acionamento após uma troca rápida de módulo levou 576 ms na amostra. A repetição preservou o mesmo pulso e Esc cancelou antes de publicar um resultado. F11, o botão e Esc foram exercitados para tela cheia. O teste conferiu o retorno ao modo Central e a revelação da saída Ambiental pelo ponteiro.

Com movimento reduzido, o resultado apareceu em 9 ms na amostra, o shader zerou o vetor de atenção e o canvas parou de desenhar. A perda induzida de contexto mostrou a mensagem de fallback. A restauração desenhou a pose estática e o canvas voltou a ficar ocioso. A demonstração continuou acessível nos oito estados. No perfil Baixo, contei 30 desenhos em 1,5 s no estado `sleep` e 45 em 1,5 s de volta à home com limite de 30 FPS. O console terminou sem erros inesperados. [Dados da WebView2](evidence/cycle-03/validacao-webview.json) · [Dados da janela nativa redimensionada](evidence/cycle-03/janela-nativa.json)

## Desempenho

Amostras de 4 s no Windows 11, com Intel Iris Xe, ANGLE D3D11, perfil Médio de 20.000 partículas e limite de 60 FPS. Medi a cadência das chamadas WebGL `POINTS` e o tempo do desenho via consulta de GPU.

| Cenário | Viewport CSS | Buffer a 1× | FPS | p95 entre quadros | p95 de desenho GPU |
| --- | --- | --- | ---: | ---: | ---: |
| Central em repouso | 1280 × 800 | 578 × 578 | 60,00 | 16,9 ms | 0,21 ms |
| Central com hover no Lens | 1280 × 800 | 578 × 578 | 59,99 | 16,9 ms | 0,19 ms |
| 4K emulado com hover no Lens | 3840 × 2160 | 1480 × 1480 | 59,99 | 16,9 ms | 0,19 ms |

Em 1280 × 800 com DPR 2× emulado, o perfil Médio preservou o limite de 1,5× e produziu um buffer de 867 × 867. A órbita manteve os quatro alvos clicáveis em todos os tamanhos verificados, e o canvas preservou a proporção 1:1.

## Limites da validação

- A execução interativa foi feita no Windows 11 com Intel Iris Xe e WebView2. As dimensões Full HD, QHD, 4K e ultrawide e as escalas acima de 1× foram emuladas na WebView2. A janela redimensionada e a tela cheia foram verificadas no sistema. A execução interativa em outros sistemas permanece sem validação neste ciclo.
- As medições caracterizam esta sessão, GPU e perfil. O chunk principal de produção do Vite tem 786,32 kB minificados e 212,75 kB com gzip, acima do limiar de aviso padrão.

Para repetir a inspeção, abra o executável de produção do [README](../README.md), passe pelos módulos com Tab e acione-os com Enter e Espaço. Faça duas seleções em sequência, pressione Esc durante a animação e alterne os modos com `Alt+1`, `Alt+2` e `Alt+3`. Use `F11` e Esc para entrar e sair da tela cheia. Compare a cena em repouso, hover e seleção com a [referência visual](visual-identity.md).
