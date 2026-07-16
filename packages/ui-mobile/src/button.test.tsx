import { fireEvent, screen } from '@testing-library/react-native';

import { Button } from './button';
import { renderWithTheme } from './test-utils';

describe('Button (mobile, render real)', () => {
  it('renderiza o rotulo e responde ao toque', () => {
    const onPress = jest.fn();
    renderWithTheme(<Button onPress={onPress}>Salvar</Button>);

    const button = screen.getByRole('button', { name: 'Salvar' });
    fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('desabilitado: nao dispara onPress e expoe accessibilityState', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <Button onPress={onPress} disabled>
        Enviar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Enviar' });
    fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('loading: accessibilityState.busy e verdadeiro', () => {
    renderWithTheme(<Button loading>Carregando</Button>);
    const button = screen.getByRole('button', { name: 'Carregando' });
    expect(button.props.accessibilityState.busy).toBe(true);
  });
});
