import { fontFamily, fontSize, fontWeight, space } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  resolveTableHeaderColors,
  resolveTableRowColors,
  tableSeparatorColor,
} from './table-variants';
import { useTheme } from './theme-context';

/**
 * Tabela MOBILE (design-system-components.md §16). Grade compacta com rolagem
 * horizontal (a paginacao numerada fica so no web — painel admin). Generica por
 * definicao de colunas. Cores em `table-variants.ts` (testavel sem RN). Sem hover
 * no touch — o hover do §16 vira o `pressed`.
 */
export type ColumnAlign = 'left' | 'right' | 'center';

export interface TableColumn<T> {
  readonly key: string;
  readonly header: string;
  readonly align?: ColumnAlign;
  /** Largura fixa da coluna (dp). Padrao 120. */
  readonly width?: number;
  readonly cell: (row: T) => ReactNode;
}

export interface TableProps<T> {
  readonly columns: readonly TableColumn<T>[];
  readonly rows: readonly T[];
  readonly getRowId: (row: T) => string;
  readonly selectedId?: string;
  readonly onRowPress?: (row: T) => void;
  readonly style?: StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  headerCell: { paddingHorizontal: space[3], paddingVertical: space[2], justifyContent: 'center' },
  headerText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.caption,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  cell: { paddingHorizontal: space[3], paddingVertical: space[2], justifyContent: 'center' },
  cellText: { fontFamily: fontFamily.body, fontSize: fontSize.small },
  dataRow: { borderBottomWidth: 1 },
});

function alignItems(align: ColumnAlign | undefined): ViewStyle['alignItems'] {
  if (align === 'right') return 'flex-end';
  if (align === 'center') return 'center';
  return 'flex-start';
}

export function Table<T>({
  columns,
  rows,
  getRowId,
  selectedId,
  onRowPress,
  style,
}: TableProps<T>): ReactNode {
  const theme = useTheme();
  const header = resolveTableHeaderColors(theme.mode);
  const separator = tableSeparatorColor(theme.mode);

  return (
    <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={false} style={style}>
      <View>
        <View style={[styles.row, { backgroundColor: header.backgroundColor }]}>
          {columns.map((col): ReactNode => (
            <View
              key={col.key}
              style={[
                styles.headerCell,
                { width: col.width ?? 120, alignItems: alignItems(col.align) },
              ]}
            >
              <Text style={[styles.headerText, { color: header.textColor }]}>{col.header}</Text>
            </View>
          ))}
        </View>

        {rows.map((row): ReactNode => {
          const id = getRowId(row);
          const selected = id === selectedId;
          return (
            <Pressable
              key={id}
              onPress={onRowPress ? () => onRowPress(row) : undefined}
              accessibilityRole={onRowPress ? 'button' : undefined}
              accessibilityState={{ selected }}
            >
              {({ pressed }): ReactNode => {
                const c = resolveTableRowColors(theme.mode, selected, pressed && !!onRowPress);
                return (
                  <View
                    style={[
                      styles.row,
                      styles.dataRow,
                      { backgroundColor: c.backgroundColor, borderBottomColor: separator },
                    ]}
                  >
                    {columns.map((col): ReactNode => {
                      const content = col.cell(row);
                      return (
                        <View
                          key={col.key}
                          style={[
                            styles.cell,
                            { width: col.width ?? 120, alignItems: alignItems(col.align) },
                          ]}
                        >
                          {typeof content === 'string' || typeof content === 'number' ? (
                            <Text style={[styles.cellText, { color: c.textColor }]}>{content}</Text>
                          ) : (
                            content
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              }}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
