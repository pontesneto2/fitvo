import { vi } from 'vitest';

/**
 * jsdom nao faz layout de verdade nem tem ResizeObserver: o ResponsiveContainer
 * do Recharts mede via `getBoundingClientRect()` dentro de um callback de
 * ResizeObserver — sem os dois mockados, o tamanho fica 0x0 e o Recharts nao
 * renderiza os filhos (evita SVG invalido). Chamar no `beforeEach` de qualquer
 * teste de `chart-line`/`chart-bar`.
 */
export function mockChartLayout(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 600,
    height: 200,
    top: 0,
    left: 0,
    bottom: 200,
    right: 600,
    x: 0,
    y: 0,
    toJSON: () => '',
  });

  class MockResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      const contentRect = target.getBoundingClientRect();
      this.callback(
        [{ target, contentRect } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
}
