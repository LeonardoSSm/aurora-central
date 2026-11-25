# Aurora Central

Home desktop do Aurora Ecosystem, com um núcleo procedural de partículas 3D e quatro módulos orbitais. A fundação do Ciclo 01 permite explorar a interface. Board, Control, Nexus e Lens informam sua indisponibilidade ao serem acionados.

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
