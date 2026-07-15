import {
  duration,
  easing,
  fontFamily,
  fontSize,
  shadows,
  shadowToNative,
} from '@fitvo/brand-tokens';
import { Check, ChevronDown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from './icon';
import type { InputStatus } from './input-variants';
import { INPUT_DIMS, resolveInputColors } from './input-variants';
import {
  filterOptions,
  resolveMenuColors,
  resolveSelectItemColors,
  SELECT_MENU_DIMS,
} from './select-variants';
import { useTheme } from './theme-context';

/**
 * Select / Dropdown MOBILE (design-system-components.md §3 + dark §21).
 *
 * - Trigger: Pressable com as regras do Input (reusa `resolveInputColors`; `open`
 *   entra como "focado"), rotulo + chevron desenhado (canto 1.5px, §19).
 * - Menu: `Modal` transparente com backdrop tocavel. No mobile nao ha ancoragem por
 *   medicao de layout — o menu abre como um painel central (padrao de picker RN),
 *   nao um popover ancorado. Superficie/itens em `select-variants.ts` (testavel sem
 *   RN); entrada fade + slide 4px (`Animated`, `duration-fast`/`ease-out`).
 * - A11y: RN nao tem `listbox`/`option` — mapeio trigger -> `button` (state
 *   `expanded`) e item -> `menuitem` (state `selected`/`disabled`), o mais proximo.
 * - Modo `searchable` (combobox — extensao do §3): `TextInput` no topo do menu
 *   filtra por substring (via `filterOptions`, testavel); sem resultado, estado
 *   vazio (§15). Sem navegacao por teclado no touch: filtra e toca.
 *
 * Controlavel: usa `value` se dado, senao estado interno.
 */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectProps {
  readonly options: readonly SelectOption[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly placeholder?: string;
  /** Habilita o campo de busca no topo do menu (combobox). */
  readonly searchable?: boolean;
  readonly searchPlaceholder?: string;
  /** Mensagem quando a busca nao retorna itens (estado vazio, §15). */
  readonly emptyLabel?: string;
  readonly status?: InputStatus;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
}

const styles = StyleSheet.create({
  trigger: {
    height: INPUT_DIMS.height,
    paddingHorizontal: INPUT_DIMS.paddingHorizontal,
    borderRadius: INPUT_DIMS.borderRadius,
    borderWidth: INPUT_DIMS.borderWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerLabel: { flexShrink: 1, fontFamily: fontFamily.body, fontSize: INPUT_DIMS.fontSize },
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  menu: {
    borderWidth: SELECT_MENU_DIMS.borderWidth,
    borderRadius: SELECT_MENU_DIMS.borderRadius,
    padding: SELECT_MENU_DIMS.padding,
    maxHeight: 320,
    ...shadowToNative(shadows.raised.light),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: SELECT_MENU_DIMS.itemPaddingV,
    paddingHorizontal: SELECT_MENU_DIMS.itemPaddingH,
    borderRadius: SELECT_MENU_DIMS.itemRadius,
  },
  itemLabel: { flexShrink: 1, fontFamily: fontFamily.body, fontSize: fontSize.small },
  search: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    paddingVertical: SELECT_MENU_DIMS.itemPaddingV,
    paddingHorizontal: SELECT_MENU_DIMS.itemPaddingH,
    borderBottomWidth: 1,
    marginBottom: SELECT_MENU_DIMS.padding,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    paddingVertical: SELECT_MENU_DIMS.itemPaddingV,
    paddingHorizontal: SELECT_MENU_DIMS.itemPaddingH,
  },
});

export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Selecione…',
  searchable = false,
  searchPlaceholder = 'Buscar…',
  emptyLabel = 'Nenhum resultado',
  status = 'default',
  disabled = false,
  accessibilityLabel,
}: SelectProps): ReactNode {
  const theme = useTheme();
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const selected = isControlled ? value : internal;
  const selectedOption = options.find((o) => o.value === selected);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const visible = searchable ? filterOptions(options, query) : options;

  const closeMenu = (): void => {
    setOpen(false);
    setQuery('');
  };

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: duration.fast,
      easing: Easing.bezier(easing.out[0], easing.out[1], easing.out[2], easing.out[3]),
      useNativeDriver: true,
    }).start();
  }, [open, anim]);

  const text = {
    principal: theme.colors.textPrincipal,
    auxiliar: theme.colors.textAuxiliar,
    sutil: theme.colors.textSutil,
  };
  const trigger = resolveInputColors(theme.mode, status, open, disabled, false, text);
  const menu = resolveMenuColors(theme.mode);

  const choose = (o: SelectOption): void => {
    if (o.disabled) return;
    if (!isControlled) setInternal(o.value);
    onValueChange?.(o.value);
    closeMenu();
  };

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open, disabled }}
        style={[
          styles.trigger,
          { backgroundColor: trigger.backgroundColor, borderColor: trigger.borderColor },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.triggerLabel,
            { color: selectedOption ? trigger.color : trigger.placeholderColor },
          ]}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon icon={ChevronDown} size="sm" color={theme.colors.textAuxiliar} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menu,
              {
                backgroundColor: menu.backgroundColor,
                borderColor: menu.borderColor,
                opacity: anim,
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Pressable "vazio" para o toque no painel nao vazar para o backdrop. */}
            <Pressable onPress={() => undefined}>
              {searchable ? (
                <TextInput
                  autoFocus
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={theme.colors.textSutil}
                  accessibilityLabel={searchPlaceholder}
                  style={[
                    styles.search,
                    { color: theme.colors.textPrincipal, borderBottomColor: menu.borderColor },
                  ]}
                />
              ) : null}
              <ScrollView bounces={false}>
                {searchable && visible.length === 0 ? (
                  <Text style={[styles.empty, { color: theme.colors.textSutil }]}>
                    {emptyLabel}
                  </Text>
                ) : null}
                {visible.map((o): ReactNode => {
                  const isSelected = o.value === selected;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => choose(o)}
                      disabled={o.disabled}
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: isSelected, disabled: o.disabled ?? false }}
                    >
                      {({ pressed }): ReactNode => {
                        const c = resolveSelectItemColors(
                          theme.mode,
                          isSelected,
                          o.disabled ?? false,
                          pressed && !o.disabled,
                          text,
                        );
                        const itemStyle: StyleProp<ViewStyle> = [
                          styles.item,
                          { backgroundColor: c.backgroundColor },
                        ];
                        return (
                          <View style={itemStyle}>
                            <Text
                              numberOfLines={1}
                              style={[styles.itemLabel, { color: c.textColor }]}
                            >
                              {o.label}
                            </Text>
                            {isSelected ? (
                              <Icon icon={Check} size="sm" color={c.checkColor} />
                            ) : null}
                          </View>
                        );
                      }}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}
