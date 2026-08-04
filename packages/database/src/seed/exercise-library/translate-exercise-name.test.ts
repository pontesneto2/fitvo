import { describe, expect, it } from 'vitest';

import { translateExerciseName } from './translate-exercise-name';

describe('translateExerciseName — tabela curada', () => {
  // Os nomes que o personal lê todo dia. Se algum destes sair errado, a base
  // comum vira ruído: é o teste que protege o valor do seed inteiro.
  it.each([
    ['Barbell Bench Press - Medium Grip', 'Supino reto com barra'],
    ['Barbell Squat', 'Agachamento livre com barra'],
    ['Barbell Deadlift', 'Levantamento terra com barra'],
    ['Barbell Curl', 'Rosca direta com barra'],
    ['Wide-Grip Lat Pulldown', 'Puxada frontal pegada aberta'],
    ['Bent Over Barbell Row', 'Remada curvada com barra'],
    ['Leg Press', 'Leg press'],
    ['Leg Extensions', 'Cadeira extensora'],
    ['Lying Leg Curls', 'Mesa flexora'],
    ['Barbell Shoulder Press', 'Desenvolvimento com barra'],
    ['Side Lateral Raise', 'Elevação lateral com halteres'],
    ['Triceps Pushdown', 'Tríceps na polia com barra'],
    ['Hammer Curls', 'Rosca martelo com halteres'],
    ['Standing Calf Raises', 'Panturrilha em pé'],
    ['Crunches', 'Abdominal supra'],
  ])('traduz %s', (english, expected) => {
    const result = translateExerciseName(english);
    expect(result.name).toBe(expected);
    expect(result.strategy).toBe('CURATED');
  });

  it('casa a curada independente de hífen e caixa', () => {
    // A fonte é inconsistente com hífen ("Close-Grip" vs "Close Grip"); a
    // tabela não pode depender disso.
    expect(translateExerciseName('close-grip barbell bench press').name).toBe(
      'Supino reto pegada fechada',
    );
  });

  it('casa a curada com apóstrofo — o token órfão "s" não pode aparecer', () => {
    expect(translateExerciseName("Farmer's Walk").name).toBe('Caminhada do fazendeiro');
  });
});

describe('translateExerciseName — composicional', () => {
  it('põe o equipamento no fim, preposicionado', () => {
    expect(translateExerciseName('Dumbbell Squat').name).toBe('Agachamento com halteres');
  });

  it('concorda o modificador em gênero com o movimento', () => {
    // O núcleo feminino puxa a forma feminina...
    expect(translateExerciseName('Alternating Kettlebell Row').name).toBe(
      'Remada alternada com kettlebell',
    );
    // ...e o masculino, a masculina. Sem isso sairia "Supino alternada".
    expect(translateExerciseName('Alternating Floor Press').name).toBe('Supino no chão alternado');
  });

  it('não repete modificador já embutido no núcleo', () => {
    // "Supino inclinado" + "inclinado" daria "Supino inclinado inclinado".
    expect(translateExerciseName('Incline Bench Press').name).toBe('Supino inclinado');
  });

  it('descarta equipamento redundante contido em outro mais específico', () => {
    // Casa "high pulley" E "cable" — deve sobrar só o mais informativo.
    expect(translateExerciseName('One-Arm High-Pulley Cable Side Bends').name).toBe(
      'Flexão lateral de tronco unilateral na polia alta',
    );
  });

  it('absorve preposição solta sem quebrar frase que a contém', () => {
    // "bent over" é FRASE (vira "curvada"); o "over" solto de outro nome é só
    // ruído. As duas coisas convivem porque a absorção vem depois do casamento.
    expect(translateExerciseName('Bent Over Two-Dumbbell Row').name).toBe(
      'Remada curvada com halteres',
    );
    expect(translateExerciseName('Palms-Down Wrist Curl Over A Bench').strategy).not.toBe(
      'UNTRANSLATED',
    );
  });
});

describe('translateExerciseName — o gate que impede tradução ruim', () => {
  it('devolve o inglês quando sobra token desconhecido', () => {
    const result = translateExerciseName("Conan's Wheel");
    expect(result.strategy).toBe('UNTRANSLATED');
    expect(result.name).toBe("Conan's Wheel");
  });

  it('devolve o inglês quando há mais de um núcleo de movimento', () => {
    // "Front Raise And Pullover" tem dois movimentos; a ordem do português não
    // é derivável por regra, então não se chuta.
    const result = translateExerciseName('Front Raise And Pullover');
    expect(result.strategy).toBe('UNTRANSLATED');
  });

  it('NÃO traduz cabeça ambígua sozinha', () => {
    // "Press" isolado é supino, desenvolvimento ou leg press — traduzir daria
    // nome errado com cara de certo. Melhor ficar em inglês.
    expect(translateExerciseName('Bent Press').strategy).toBe('UNTRANSLATED');
    expect(translateExerciseName('Dumbbell Raise').strategy).toBe('UNTRANSLATED');
  });

  it('nunca devolve string vazia', () => {
    expect(translateExerciseName('').name).toBe('');
    expect(translateExerciseName('   ').strategy).toBe('UNTRANSLATED');
  });
});
