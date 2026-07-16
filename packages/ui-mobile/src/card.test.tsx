import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from './card';
import { renderWithTheme } from './test-utils';

describe('Card (mobile, render real)', () => {
  it('variante default: renderiza o conteudo, sem role de botao', () => {
    renderWithTheme(
      <Card>
        <Text>Ficha do paciente</Text>
      </Card>,
    );
    expect(screen.getByText('Ficha do paciente')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('variante interactive: vira Pressable e dispara onPress', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <Card variant="interactive" onPress={onPress} accessibilityLabel="Abrir ficha">
        <Text>Ficha do paciente</Text>
      </Card>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Abrir ficha' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('interactive + disabled: nao dispara onPress', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <Card variant="interactive" onPress={onPress} disabled accessibilityLabel="Abrir ficha">
        <Text>Ficha do paciente</Text>
      </Card>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Abrir ficha' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
