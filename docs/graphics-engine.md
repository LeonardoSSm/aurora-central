# Motor gráfico do núcleo Aurora

O núcleo é uma nuvem `Points` do Three.js sobre WebGL 2. A geometria tem um atributo de posição estático com capacidade para 100 mil partículas. Cada perfil usa `BufferGeometry.setDrawRange` para desenhar um prefixo desse buffer. Há um material GLSL e uma chamada `POINTS` por desenho. O React envia configurações e mudanças de estado. A interpolação, o cursor e o relógio de animação são atualizados fora do React.

## Forma, movimento e luz

`particles.ts` gera quatro lotes Fibonacci aninhados por prefixo. Cada lote cobre a esfera inteira e varia o raio com uma sequência determinística. Aproximadamente 24% dos pontos têm distribuição uniforme por volume até o raio 0,91. Os demais ocupam camadas externas com espessuras diferentes. Os 5 mil pontos do primeiro lote formam a camada externa mais fina. Os lotes seguintes dão profundidade às dobras sem reconstruir o buffer ao mudar de perfil.

O vertex shader combina dois campos de ruído 3D, ondas de frequência diferente, cisalhamento e respiração. As partículas compartilham o campo de deformação e amostram posições diferentes nele. A câmera usa projeção em perspectiva. Profundidade, proximidade das cristas e variação determinística por partícula determinam o tamanho e a intensidade na tela. O cursor altera a inclinação em dois eixos e desloca levemente o centro com amortecimento.

A paleta combina azul, violeta, lilás, magenta, rosa e coral. Um foco coral migra lentamente pela região frontal. As cristas elevam o brilho dos pontos e as regiões internas recebem menos luz. O fragment shader desenha o ponto e seu halo curto com mistura aditiva em um canvas transparente. O fundo da home vem do CSS. A renderização usa um único passe e dispensa texturas e pós-processamento.

## Estados

| Estado | Comportamento |
| --- | --- |
| `idle` | Respiração lenta, dobras em deriva e rotação gradual |
| `listening` | Núcleo ligeiramente aberto, cor fria e ondulação que sobe por faixas |
| `thinking` | Violeta mais presente, rotação acelerada e ondas oblíquas cruzando as dobras |
| `speaking` | Pulsos coral com ritmo irregular e expansão proporcional à amplitude recebida |
| `executing` | Faixa móvel mais luminosa que percorre o núcleo enquanto ele gira |
| `success` | Frente luminosa ascendente e breve expansão rosa-coral |
| `error` | Contração, tons quentes e relevo irregular com variação contínua |
| `sleep` | Núcleo menor, frio e pouco luminoso, com movimento e cadência reduzidos |

`CoreInput` recebe um `CoreState` e uma amplitude normalizada opcional entre 0 e 1. `CoreMotion` interpola a pose exponencialmente. Ele integra separadamente o tempo do campo e a rotação para preservar a fase quando a velocidade muda. A amplitude tem ataque de 65 ms e liberação de 190 ms. O controle da demonstração injeta a amplitude pela mesma interface que poderá receber dados de áudio em outro ciclo.

## Ciclo de vida e acessibilidade

O tamanho do buffer acompanha a área CSS do canvas e o menor valor entre o DPR real e o limite selecionado. Os limites de cadência podem ser alterados na demonstração. A página oculta para o desenho, a janela desfocada usa até 20 FPS e a inatividade de 45 segundos reduz a cadência para até 30 FPS. `sleep` usa no máximo 20 FPS. O relógio de animação pausa junto com a renderização.

`prefers-reduced-motion: reduce` usa uma pose fixa por estado, desativa o parallax e desenha quando o estado ou as dimensões mudam. Se a WebView perder o contexto, o canvas dá lugar a uma mensagem de estado. O Three.js restaura seu cache WebGL e o motor reaplica o perfil e o viewport, preservando a pose. Geometria, material, renderizador, agendamentos e listeners são liberados ao desmontar.

A demonstração é acessível pelo rodapé ou pelo hash `#/nucleo`. Os estados e a amplitude de teste pertencem à demonstração. As opções de perfil, FPS e DPR aplicam-se também à home e duram enquanto o aplicativo permanecer aberto. A validação de plataforma e as medições ficam no [relatório do Ciclo 02](cycle-02.md).
