# Aurora Central

Home desktop do Aurora Ecosystem, com um núcleo volumétrico de partículas 3D e um launcher para Board, Control, Nexus e Lens.

## Requisitos

- Node.js 24 LTS ou Node.js 22 a partir da versão 22.13, com npm.
- Rust estável com `rustfmt` e o toolchain nativo da plataforma.
- Windows com Microsoft C++ Build Tools e Microsoft Edge WebView2.
- Linux com as dependências da distribuição para Tauri 2. O workflow usa Ubuntu 24.04.

[Tauri 2 — pré-requisitos por plataforma](https://v2.tauri.app/start/prerequisites/)

## Desenvolvimento

```sh
npm ci
npm run tauri dev
```

`npm run dev` executa a mesma interface em `http://127.0.0.1:1420` para iteração visual no navegador.

Na home, use os botões de visualização ou `Alt+1`, `Alt+2` e `Alt+3` para abrir os modos Central, Imersivo e Ambiental. `Esc` volta à Central, cancela uma seleção em curso e sai da tela cheia. `F11` alterna a tela cheia. No modo Ambiental, mover o ponteiro, tocar ou focar o botão com Tab revela **Voltar à Central**.

Abra **Demonstração do núcleo** no rodapé da home para testar os oito estados e ajustar perfil, FPS e DPR. As opções gráficas também se aplicam à home durante a sessão. O controle de amplitude fica disponível no estado **Falando**.

No desktop, abra **Aplicativos** e escolha um módulo. Use **Selecionar executável** e confirme o arquivo no diálogo nativo. Depois, acione o módulo na órbita ou use **Testar abertura**. No Windows, a configuração inclui o monitor para aplicativos que permitem posicionamento pelo Central. [Integração de aplicativos](docs/application-integration.md)

## Verificação e build

```sh
npm run lint
npm run typecheck
npm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run tauri build -- --no-bundle -- --locked
cargo test --manifest-path src-tauri/Cargo.toml --release --locked --features tauri/custom-protocol
```

O build gera o executável em `src-tauri/target/release/`. Windows usa `aurora-central.exe`. A execução de `cargo test` com o protocolo de produção usa o frontend já compilado pelo build. O Ciclo 01 valida o binário local, com empacotamento e release previstos no roadmap.

## Documentação

- [Visão do produto](docs/product-vision.md)
- [Arquitetura e decisões técnicas](docs/architecture.md)
- [Identidade visual e referência oficial](docs/visual-identity.md)
- [Roadmap](docs/roadmap.md)
- [Relatório e evidências do Ciclo 01](docs/cycle-01.md)
- [Motor gráfico](docs/graphics-engine.md)
- [Relatório e evidências do Ciclo 02](docs/cycle-02.md)
- [Relatório e evidências do Ciclo 03](docs/cycle-03.md)
- [Integração de aplicativos](docs/application-integration.md)
- [Segurança do launcher](docs/security.md)
- [Relatório e evidências do Ciclo 04](docs/cycle-04.md)
