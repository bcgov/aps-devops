interface StatCardProps {
  value: number | string;
  label: string;
  href?: string;
}

export function StatCard({ value, label, href }: StatCardProps) {
  const inner = (
    <div className="bg-white rounded-lg shadow-md p-8 text-center hover:shadow-lg transition-shadow h-full flex flex-col items-center justify-center">
      <div className="text-4xl font-bold text-[#003366] mb-2">{value}</div>
      <div className="text-gray-600 text-sm font-medium uppercase tracking-wide">{label}</div>
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
