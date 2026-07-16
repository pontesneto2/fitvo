import { fireEvent, screen } from '@testing-library/react-native';

import { Badge } from './badge';
import { renderWithTheme } from './test-utils';

describe('Badge (mobile, render real)', () => {
  it('renderiza o rotulo (children string)', () => {
    renderWithTheme(<Badge variant="brand">Ativo</Badge>);
    expect(screen.getByText('Ativo')).toBeTruthy();
  });

  it('removivel: botao de remocao dispara onRemove ao toque', () => {
    const onRemove = jest.fn();
    renderWithTheme(
      <Badge variant="neutral" onRemove={onRemove} removeLabel="Remover filtro">
        Nutrição
      </Badge>,
    );

    fireEvent.press(screen.getByLabelText('Remover filtro'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('sem onRemove, nao mostra o botao de remocao', () => {
    renderWithTheme(<Badge variant="brand">Ativo</Badge>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
