# Arquitetura

A janela é criada por Tauri 2 e Rust. A WebView do sistema renderiza o frontend React, TypeScript e Vite. O build incorpora os assets compilados no aplicativo. O servidor Vite serve apenas ao desenvolvimento, com bind em loopback. A janela usa Tauri com configuração de produção local.

| Local | Responsabilidade |
| --- | --- |
| `src/ui/` | Home, navegação por teclado, composição orbital e feedback visual |
| `src/graphics/` | Canvas, distribuição inicial, shaders GLSL e ciclo de renderização WebGL |
| `src/domain/registry.ts` | IDs, nomes, âncoras e disponibilidade dos módulos |
| `src/domain/commands.ts` e `events.ts` | Contratos para pedido de abertura e resultado |
| `src/domain/launcher.ts` | Resultado local de abertura da fundação |
| `src/domain/state.ts` | Apresentação do estado do pedido, guardado na home com `useState` |
| `src/desktop/` | Interfaces para um futuro adaptador nativo e para persistência |
| `src-tauri/` | Janela, build Rust, CSP e capability |

Acionar um botão cria `module.open` com um ID fechado. O launcher retorna `module.open.settled` com `unavailable` e a UI publica o feedback em uma região de status acessível. Nenhum executável, argumento, caminho ou segredo é solicitado pela interface. A futura implementação nativa poderá receber IDs registrados e usar estratégia específica da plataforma.

## Decisões

- **WebGL e GLSL na fundação**. Um canvas, um buffer de 7 mil posições e uma chamada de desenho por quadro atendem à prévia. A deformação e a projeção ficam no shader. A UI React controla somente o ciclo de vida do canvas. O fundo procedural em CSS mantém a composição quando a WebView não inicializa WebGL.
- **Three.js e React Three Fiber**. Three.js oferece `BufferGeometry`, `Points`, materiais GLSL e gerenciamento de cena. R3F é seu renderizador declarativo para React e agrega valor se o motor precisar compor cenas e elementos interativos. O custo nesta fundação seria adicionar dependências e um segundo ciclo de vida para uma única nuvem. O Ciclo 02 avaliará o motor com essas ferramentas e medirá os perfis previstos na issue. [Three.js](https://threejs.org/docs/) · [React Three Fiber](https://r3f.docs.pmnd.rs/getting-started/introduction)
- **Estado local de React**. A seleção serve apenas à home. Zustand pode atender quando motor, controles e provedor de eventos precisarem de seletores e assinaturas fora da árvore React. Estado por quadro permanece no renderizador. [Zustand](https://github.com/pmndrs/zustand)
- **Adaptadores sob demanda**. As interfaces registram as fronteiras do launcher e da persistência. As implementações e seus requisitos de plataforma entram nos ciclos correspondentes.

## Fronteiras de execução

A capability `main-local` é restrita à janela `main`, com lista vazia de permissões. O projeto não registra comandos Tauri nem plugins de shell, processo, filesystem, HTTP ou abertura externa. A CSP de produção permite scripts e estilos locais e bloqueia conexões, formulários, frames e objetos. O app não exige contas, chaves ou arquivos de ambiente. Qualquer futura ampliação da fronteira de IPC deve declarar permissões específicas e validar a entrada no backend. [Capabilities do Tauri](https://v2.tauri.app/security/capabilities/)
