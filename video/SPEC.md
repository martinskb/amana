# Amana — vídeo de apresentação (SPEC)

GOAL:    o dono de barbearia que vive no WhatsApp sente o alívio ("chuva") e entende em 1 min que o link marca por ele.
OUTPUT:  HyperFrames, 1080 x 1920, 30 fps, vertical (Reels / Status).
TIME:    63 s x 30 = 1890 frames. Música 80 BPM: 0,75 s (22,5 frames) por batida; entra em 4,5 s; batida k = 4,5 + 0,75k.
LOOK:    chão #121012 com a chuva da Amana (riscos a 105°, roxo #B272DE a 14%, 3 px a cada 36 px, descendo linear);
         tinta #F3EEE9 (títulos #EFE3F6); acento único #B272DE, só na palavra-chave de cada título e na gota;
         títulos Bricolage Grotesque 800, 92–128 px, tracking -0,04em, 1–2 linhas, alinhados à esquerda em x=84;
         respiro em Caveat 700, roxo, girado -3°, no máximo 3 vezes;
         produto = prints reais do app (1170 px de largura) num celular de 760 px de largura, moldura #000 de 16 px,
         raio 96 px, contorno 2 px #383238, sombra 0 40px 80px rgba(0,0,0,.55). Sem grão, sem vinheta, sem brilho.
OBJECTS: o celular (o app real dentro); bolhas de mensagem genéricas (cinza #282428, sem marca de nenhum app);
         a gota açaí (o path do logo); o monitor do computador (moldura #000 de 22 px, base de 160 px).
MOTION:  chegada expo.out 0,5–0,7 s; câmera e pan power2.inOut 0,6–0,9 s; saída power3.in 0,3 s;
         títulos por palavra: blur 6 px → 0 e opacidade em 0,13 s, 0,08 s entre palavras, sem deslocamento;
         toque: dedo (círculo 84 px, #F3EEE9 a 35%) chega 0,2 s antes, aperta 0,85 por 0,12 s, a tela troca no frame do toque.
SHOTS:   0–4,5 aperto: bolhas empilhando cada vez mais rápido, contador 1→47, "tem horário?" crescendo; gota cai (som) → íris.
         4,5–10,5 chuva: a gota cai e vira o ponto do logo "amana"; "amana = chuva, em tupi"; Caveat "respira."
         10,5–21 agenda: celular sobe; "seu dia, num olhar"; rolagem; zoom em "marcou sozinho!"; toque em Rafa → filtro.
         21–37,5 link do cliente: whip; serviço → com quem → dia/hora → dados → "Pronto, Lucas!" (pop).
         37,5–42 caiu na agenda: zoom no "marcou sozinho! · pelo link".
         42–46,5 WhatsApp: detalhe do Pedro, toque em "Confirmar no WhatsApp".
         46,5–52,5 equipe: painel da Rafa, "Copiar link"; o celular da Rafa entra pela direita com a página dela.
         52,5–57 computador: o monitor sobe com a agenda em 1280 px; o celular fica na frente.
         57–63 fim: chuva, a gota cai no logo (riser → impacto), "aproveita a chuva", "agenda para quem atende".
SOUND:   0–4,5 só notificações (sem música), aceleram; música lo-fi entra no logo; chuva de verdade em 4,5–13 e 56–63;
         whoosh em cada troca de cena (3 tomadas alternadas), toque em cada dedo, pop nos chips e no "Pronto"; riser só no fim.
BANNED:  vazio escuro com coisa pequena no meio; brilho, neon, partículas; gradientes roxos; cards de vidro; três cards em fila;
         tudo centralizado; tudo surgindo e subindo junto; título que se mexe enquanto é lido; logo no canto;
         anéis de clique; UI inventada (só prints reais); a marca do WhatsApp nas bolhas.
QA:      0,0 (gancho legível sem som); 4,3 (íris); 8,5 (logo); 14 (zoom marcou sozinho); 17,6 (filtro Rafa);
         33,5 (Pronto, Lucas!); 39 (pelo link); 44 (WhatsApp); 50 (página da Rafa); 55 (computador); 61,5 (fim).
