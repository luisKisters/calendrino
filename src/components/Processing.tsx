interface ProcessingProps {
  label: string;
  onCancel: () => void;
}

export function Processing({ label, onCancel }: ProcessingProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-indigo-400" />
      <p className="text-lg font-medium">{label}</p>
      <button onClick={onCancel} className="text-sm text-gray-400 transition hover:text-white">
        Cancel
      </button>
    </div>
  );
}
