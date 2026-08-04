import { INEXACT_MUSCLE_MAPPINGS } from './muscle-group-map';
import type { SeedResult } from './seed-exercise-library';

/**
 * Relatório legível do seed. Existe porque este import faz escolhas que NÃO
 * aparecem no banco: campo da fonte que não tem coluna, músculo aproximado,
 * nome que ficou em inglês. Um seed que só imprime "873 ok" esconde exatamente
 * a parte que alguém precisa revisar.
 */
export function formatSeedReport(result: SeedResult): string {
  const { report } = result;
  const lines: string[] = [];

  lines.push('── Seed da biblioteca PLATFORM de exercícios ──');
  lines.push(`Fonte (free-exercise-db)      : ${report.totalSource} registros`);
  lines.push(`Mapeados                      : ${report.totalMapped}`);
  lines.push(`Inseridos agora               : ${result.inserted}`);
  lines.push(`Já existiam (pulados)         : ${result.skippedExisting}`);
  lines.push(
    `Especialidade TRAINING        : ${result.specialtyId ?? '(não seedada — specialtyId nulo)'}`,
  );

  lines.push('');
  lines.push('── Tradução pt-BR ──');
  lines.push(`Tabela curada                 : ${report.translation.curated}`);
  lines.push(`Composicional                 : ${report.translation.compositional}`);
  lines.push(`SEM tradução (nome em inglês) : ${report.translation.untranslated}`);
  lines.push(
    'Instruções (description)      : TODAS em inglês — não há caminho de ' +
      'tradução automática de texto corrido disponível neste repo.',
  );

  lines.push('');
  lines.push('── Músculo ──');
  if (report.unmappedMuscles.length === 0) {
    lines.push('Sem correspondente no catálogo: nenhum.');
  } else {
    lines.push('SEM correspondente (caíram no grupo genérico):');
    for (const entry of report.unmappedMuscles) {
      lines.push(`  ${entry.value} — ${entry.count} ocorrência(s)`);
    }
  }
  for (const inexact of INEXACT_MUSCLE_MAPPINGS) {
    lines.push(
      `Aproximação: "${inexact.sourceMuscle}" → ${inexact.muscleGroupCode}. ${inexact.reason}`,
    );
  }

  lines.push('');
  lines.push('── Campos da fonte SEM coluna no schema (nada foi gravado) ──');
  lines.push(
    'level, force, mechanic, category, equipment e imagens não têm coluna em ' +
      '`Exercise`. Foram mapeados e contados, não persistidos. Ver docs/pendencias-mesa.md.',
  );
  lines.push(`Imagens vistas e NÃO importadas: ${report.imagesNotImported}`);
  if (report.unmappedEquipment.length > 0) {
    lines.push('Equipamento sem de-para:');
    for (const entry of report.unmappedEquipment) {
      lines.push(`  ${entry.value} — ${entry.count}`);
    }
  }
  if (report.inexactEquipment.length > 0) {
    lines.push('Equipamento mapeado como "outro" (sem item exato no D-187):');
    for (const entry of report.inexactEquipment) {
      lines.push(`  ${entry.value} — ${entry.count}`);
    }
  }

  lines.push('');
  lines.push('── Robustez a dado incompleto da fonte ──');
  lines.push(
    `Nulos tolerados — force: ${report.nullSourceFields.force}, ` +
      `mechanic: ${report.nullSourceFields.mechanic}, ` +
      `equipment: ${report.nullSourceFields.equipment}`,
  );
  lines.push(`Sem instruções na fonte        : ${report.withoutDescription}`);
  lines.push(
    `Duplicatas normalizadas na fonte: ${report.duplicatesWithinSource.length} (descartadas)`,
  );

  return lines.join('\n');
}
