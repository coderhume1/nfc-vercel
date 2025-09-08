export default function Section({ title, actions, children }: { title: string, actions?: React.ReactNode, children: React.ReactNode }) {
  return (
    <section className="container my-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="card">{children}</div>
    </section>
  );
}
