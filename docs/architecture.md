# Arquitetura

A janela é criada por Tauri 2 e Rust. A WebView do sistema renderiza o frontend React, TypeScript e Vite. O build incorpora os assets compilados no aplicativo. O servidor Vite serve apenas ao desenvolvimento, com bind em loopback. A janela usa Tauri com configuração de produção local.

| Local | Responsabilidade |
| --- | --- |
| `src/ui/` | Home, navegação por teclado, composição orbital e feedback visual |
| `src/graphics/` | Canvas WebGL 2, perfis, estados, amostragem volumétrica, shaders GLSL e ciclo de renderização |
| `src/domain/registry.ts` | IDs, nomes, ícones, cores, posições, disponibilidade e estratégias de abertura |
| `src/domain/commands.ts` e `events.ts` | Contratos tipados de abertura, cancelamento antes do envio e resultado |
| `src/domain/selection.ts` | Duração e ciclo de vida da seleção, incluindo concorrência e descarte |
| `src/domain/launcher.ts` e `state.ts` | Resultado local de disponibilidade e apresentação do resultado |
| `src/desktop/` | Tela cheia e interfaces para o launcher nativo e para persistência |
| `src-tauri/` | Janela, build Rust, CSP e capability |

Acionar um botão prepara `module.open` com um ID derivado do registry e um `requestId` sequencial na instância da home. A seleção dispara uma transição de 540 ms e então entrega o comando ao launcher. Com movimento reduzido, o envio é imediato. O launcher deste ciclo retorna `module.open.settled` com `unavailable` e a UI publica o resultado em uma região de status acessível. O contrato também prevê `opened` e `failed` para o adaptador nativo.

A seleção pendente é idempotente para o mesmo módulo. Selecionar outro módulo, mudar de modo ou pressionar Esc cancela a transição pendente. `module.open.cancelled` descreve o cancelamento antes do envio. Se um futuro launcher assíncrono já tiver recebido o comando, a home ignora seu resultado após uma seleção mais recente ou abandono. O adaptador do Ciclo 04 será responsável pelo ciclo de vida dos processos. A interface trabalha com IDs registrados e exclui campos para executáveis, argumentos, caminhos e segredos.

## Decisões

- **Three.js e GLSL no núcleo**. O Ciclo 02 usa `BufferGeometry`, `Points` e `RawShaderMaterial` sobre WebGL 2. O React monta o canvas e envia alterações de estado. O renderizador possui o agendamento e as atualizações por quadro. [Motor gráfico](graphics-engine.md)
- **Estado local de React**. A home guarda o modo, a seleção e a geometria da órbita. Um `ResizeObserver` recalcula a projeção com a área disponível. Os mesmos pontos posicionam os botões, as âncoras e a direção da resposta do núcleo. A interpolação por quadro permanece no renderizador.
- **Adaptadores sob demanda**. As interfaces registram as fronteiras do launcher e da persistência. As implementações e seus requisitos de plataforma entram nos ciclos correspondentes.

## Fronteiras de execução

A capability `main-local` é restrita à janela `main` e concede apenas `core:window:allow-set-fullscreen`. O frontend chama a API oficial de janela do Tauri. A versão de desenvolvimento no navegador usa a Fullscreen API do documento. O projeto segue sem comandos próprios, plugins de shell, processo, filesystem, HTTP ou abertura externa. A CSP de produção permite scripts e estilos locais e limita `connect-src` ao transporte interno do Tauri. Formulários, frames e objetos continuam bloqueados. [Permissões do Tauri](https://v2.tauri.app/reference/acl/core-permissions/) · [CSP do Tauri](https://v2.tauri.app/security/csp/)
