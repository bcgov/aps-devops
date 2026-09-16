interface StatCardProps {
  value: number | string;
  label: string;
  href?: string;
}

export function StatCard({ value, label, href }: StatCardProps) {
  const inner = (
    <div className="bg-white border border-border rounded-lg shadow-sm p-8 text-center hover:shadow-md hover:border-border-medium transition h-full flex flex-col items-center justify-center">
      <div className="text-4xl font-bold text-bc-blue mb-2">{value}</div>
      <div className="text-ink-secondary text-sm font-medium uppercase tracking-wide">{label}</div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block h-full no-underline">
        {inner}
      </a>
    );
  }

  return inner;
}
