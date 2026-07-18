import { redirect } from 'next/navigation';

/** Raiz: manda para o painel. O middleware desvia para /login se nao ha sessao. */
export default function RootPage(): never {
  redirect('/painel');
}
