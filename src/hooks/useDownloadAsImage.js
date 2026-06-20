// Hook reutilizável: dá uma ref pra acoplar ao card e uma fn `baixar` que
// gera um PNG nítido via html-to-image (SVG foreignObject, fontes vetoriais).
import { useCallback, useRef } from 'react';
import { toPng } from 'html-to-image';

export default function useDownloadAsImage(filename = 'card') {
  const ref = useRef(null);

  const baixar = useCallback(async () => {
    if (!ref.current) return;
    try {
      const node = ref.current;
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        pixelRatio: 3,
        cacheBust: true,
        quality: 1,
        skipFonts: false,
        style: { boxShadow: 'none', transform: 'none' },
      });
      const link = document.createElement('a');
      const hojeIso = new Date().toISOString().slice(0, 10);
      const name = typeof filename === 'function' ? filename() : filename;
      link.download = `${name}-${hojeIso}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Erro ao baixar imagem:', e);
      alert('Erro ao baixar imagem: ' + e.message);
    }
  }, [filename]);

  return { ref, baixar };
}
