# Aurora Central

Home desktop do Aurora Ecosystem, com um núcleo volumétrico de partículas 3D e um launcher para Board, Control, Nexus e Lens.

## Instalação no Windows

A distribuição v0.1.0 usa um instalador NSIS x64 por usuário. A validação interativa desta versão foi feita no Windows 11. O instalador usa o Microsoft Edge WebView2 já presente no sistema e precisa de internet se tiver de baixar o bootstrapper da Microsoft. Node.js e Rust são requisitos apenas para compilar o projeto. [Instaladores Windows do Tauri](https://v2.tauri.app/distribute/windows-installer/)

1. Obtenha o arquivo `*_x64-setup.exe` e o `SHA256SUMS.txt` da mesma origem. Durante a aprovação, eles ficam no artefato `aurora-central-windows-x64` do CI do PR. Após a publicação, use a página de releases. [GitHub Releases](https://github.com/LeonardoSSm/aurora-central/releases)
2. No PowerShell, execute `Get-FileHash .\*_x64-setup.exe -Algorithm SHA256` e compare com o valor em `SHA256SUMS.txt`. O instalador da candidata foi gerado sem assinatura Authenticode e pode receber um aviso de editor desconhecido. O hash confere o conteúdo do arquivo com o manifesto obtido na mesma origem.
3. Execute o instalador e abra **Aurora Central** pelo menu Iniciar. Para remover o aplicativo, use **Configurações do Windows → Aplicativos → Aplicativos instalados**. A entrada **Restaurar padrões**, dentro do Central, redefine as preferências. As autorizações de executáveis são revogadas individualmente em **Aplicativos**.

## Configuração e uso

Na home, use os botões de visualização ou `Alt+1`, `Alt+2` e `Alt+3` para abrir os modos Central, Imersivo e Ambiental. `Esc` volta à Central, cancela uma seleção em curso e sai da tela cheia. `F11` alterna a tela cheia. No modo Ambiental, mover o ponteiro, tocar ou focar o botão com Tab revela **Voltar à Central**.

Abra **Configurações** no rodapé para ajustar aparência, desempenho, modo inicial, aplicativos, monitores e movimento reduzido. A prévia usa o próprio núcleo. Use **Aplicar** para salvar no desktop. No Windows, as preferências ficam em `%APPDATA%\io.github.leonardossm.auroracentral\settings.json`. [Schema e recuperação](docs/cycle-06.md)

Em **Aplicativos**, escolha o módulo, selecione o executável instalado e confirme pelo diálogo nativo. **Testar abertura** usa a mesma operação da órbita. As preferências de monitor ficam em **Monitores**. Os aplicativos são distribuídos separadamente. [Integração por módulo](docs/application-integration.md)

Abra **Demonstração do núcleo** para experimentar os oito estados e ajustar perfil, FPS e DPR durante a sessão. O controle de amplitude fica disponível no estado **Falando**.

Abra **Conversa** no modo Central para usar a **Simulação local**. Experimente **Sobre Aurora Nexus** ou **Simular entrada por voz**. **Abrir Aurora Board** propõe uma abertura pelo launcher desktop e apresenta a confirmação separadamente. [Contratos e validação do Ciclo 05](docs/cycle-05.md)

## Limitações conhecidas

- Aurora AI e Aurora Nexus têm contratos tipados para integração futura. A conversa usa uma simulação local identificada na interface. Reconhecimento e leitura dependem dos recursos locais de voz em `pt-BR`. A transcrição preenche um rascunho para revisão.
- O núcleo depende de WebGL 2, da GPU e das capacidades da WebView. O foco de janelas no Windows está sujeito às regras do sistema e à disponibilidade de uma janela elegível. O Control mantém o posicionamento próprio.
- A distribuição desta versão é Windows x64. O Ubuntu tem build e testes no CI, com execução visual e pacote Linux pendentes. O foco e o posicionamento de janelas externas continuam sob responsabilidade do ambiente gráfico no Linux. A compatibilidade do macOS permanece pendente.

## Requisitos de desenvolvimento

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
npm audit
cargo audit --file src-tauri/Cargo.lock
```

O build gera o executável em `src-tauri/target/release/`. Os testes Rust com o protocolo de produção usam o frontend compilado pelo build. `cargo audit` requer o Cargo Audit.

Para gerar o instalador em um ambiente Windows x64, execute `npm run tauri build -- --bundles nsis --no-binary-patching -- --locked`. O pacote fica em `src-tauri/target/release/bundle/nsis/`. O fluxo de CI gera o manifesto SHA-256 e guarda os arquivos como artefatos de revisão. [Preparação da release](docs/implementation-report.md)

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
- [Relatório, contratos e evidências do Ciclo 05](docs/cycle-05.md)
- [Configurações, contratos e evidências do Ciclo 06](docs/cycle-06.md)
- [Fechamento técnico e evidências da v0.1.0](docs/implementation-report.md)
- [Changelog](CHANGELOG.md)
