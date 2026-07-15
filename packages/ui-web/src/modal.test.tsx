import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './modal';

describe('Modal (web)', () => {
  it('fechado: nao renderiza nada', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Confirmar">
        corpo
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('aberto: dialog com aria-modal e aria-labelledby pelo titulo', () => {
    render(
      <Modal open onClose={() => {}} title="Excluir paciente">
        Tem certeza?
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Excluir paciente' }).id).toBe(labelId);
  });

  it('Esc fecha', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T">
        corpo
      </Modal>,
    );
    const prevented = fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(prevented).toBe(false); // preventDefault chamado
  });

  it('clique no overlay fecha; clique no painel nao', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T">
        corpo
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog); // painel: nao fecha
    expect(onClose).not.toHaveBeenCalled();
    const overlay = dialog.parentElement as HTMLElement;
    fireEvent.mouseDown(overlay); // overlay: fecha
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('botao × fecha e tem aria-label', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T" closeLabel="Fechar diálogo">
        corpo
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fechar diálogo' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('move o foco para o painel ao abrir e trava a rolagem do body', () => {
    render(
      <Modal open onClose={() => {}} aria-label="Sem título" showClose={false}>
        corpo
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('Tab e interceptado (focus trap) mesmo sem focaveis visiveis', () => {
    render(
      <Modal open onClose={() => {}} aria-label="X" showClose={false}>
        corpo
      </Modal>,
    );
    const prevented = fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(prevented).toBe(false); // preventDefault chamado -> foco preso
  });
});
