# Arquitetura

Tauri 2 e Rust criam a janela. A WebView do sistema renderiza React, TypeScript e Vite. O build incorpora os assets compilados no aplicativo. O servidor Vite serve ao desenvolvimento em loopback.

| Local | Responsabilidade |
| --- | --- |
| `src/ui/` | Home, navegação por teclado, composição orbital, feedback e diálogo de aplicativos |
| `src/graphics/` | Canvas WebGL 2, perfis, estados, amostragem volumétrica, shaders GLSL e ciclo de renderização |
| `src/domain/` | Identidade visual dos módulos, comandos, resultados e transição orbital |
| `src/desktop/` | Tela cheia, IPC tipado e atualização de estado na WebView |
| `src-tauri/src/launcher/contracts.rs` | IDs, políticas, estratégias e contratos do launcher |
| `src-tauri/src/launcher/service.rs` | Registro em execução, coordenação de abertura, processos iniciados e atualização de estados |
| `src-tauri/src/launcher/executable.rs` e `store.rs` | Validação, autorização, início nativo e persistência transacional por plataforma |
| `src-tauri/src/launcher/platform/` | Descoberta de processos e monitores, verificação de janelas, foco e posicionamento |

O React monta o canvas e passa estados ao renderizador. Three.js e GLSL trabalham com `BufferGeometry`, `Points` e `RawShaderMaterial` sobre WebGL 2. Um `ResizeObserver` recalcula a projeção orbital. Os mesmos pontos posicionam botões, âncoras e a direção da resposta do núcleo. O renderizador mantém as atualizações por quadro. [Motor gráfico](graphics-engine.md)

## Fluxo de abertura

1. A home cria `module.open` com ID registrado e `requestId` da seleção. Após o pulso de 540 ms, ou imediatamente com movimento reduzido, o adaptador envia apenas o ID ao Rust.
2. O launcher serializa mudanças de configuração, descoberta e decisão de spawn. Ele verifica a aprovação e procura uma instância pelo executável. Quando existe uma janela elegível, o adaptador tenta focá-la. Para um novo processo, o launcher retém o handle de filho para observar a saída.
3. A WebView acompanha a inicialização em paralelo com a consulta periódica de estado. A descoberta de janela, uma resposta do adaptador, um erro ou o limite de espera conclui o pedido. `module.open.settled` correlaciona o resultado à seleção original.
4. Mudar de modo, pressionar Esc ou selecionar outro módulo descarta a seleção anterior. Se o pulso ainda estiver em curso, o comando deixa de ser enviado. Se o Rust já recebeu o pedido, a home descarta a resposta anterior e o processo continua independente.

As entradas de apresentação trazem nome, ícone, cor e ângulo. A política nativa fornece argumentos permitidos e estratégia. Um novo módulo usa as mesmas rotinas de abertura e projeção depois de receber uma entrada nessas duas tabelas. O registro persistente guarda a aprovação do usuário e a preferência de monitor. A política fica compilada no Rust.

## Fronteiras de execução

`main-local` permite tela cheia e cinco comandos de launcher na WebView local `main`. A seleção e a confirmação do executável ocorrem em diálogos nativos abertos pelo Rust. A CSP de produção limita conexões ao transporte interno do Tauri e bloqueia frames, formulários e objetos. A versão de navegador usa a Fullscreen API e informa que a abertura de aplicativos requer desktop. [Integração](application-integration.md) · [Segurança](security.md)
