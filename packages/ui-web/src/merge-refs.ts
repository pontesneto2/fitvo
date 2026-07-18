import type { Ref } from 'react';

/**
 * Aplica um mesmo node a varias refs (callback ou objeto). Serve para compor um
 * ref ENCAMINHADO (`forwardRef`, do consumidor) com um ref INTERNO no mesmo
 * elemento — ex.: o Checkbox usa um ref interno para setar `indeterminate` e ao
 * mesmo tempo precisa expor o input ao `register()` do React Hook Form.
 */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): (node: T | null) => void {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as { current: T | null }).current = node;
      }
    }
  };
}
