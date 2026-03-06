export function HomePlaceholderPage({ title }: { title: string }) {
  return (
    <section className="progressive-card rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-[#232D4F]">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">Pantalla en construcción.</p>
    </section>
  )
}
