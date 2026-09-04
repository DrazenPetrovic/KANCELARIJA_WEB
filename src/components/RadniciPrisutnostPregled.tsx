import { Clock } from "lucide-react";

const PRIMARY = "#785E9E";

export function RadniciPrisutnostPregled() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Clock size={20} style={{ color: PRIMARY }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
          Pregled prisutnosti
        </h2>
      </div>

      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-10 flex items-center justify-center">
        <p className="text-sm text-gray-400 dark:text-[#5f5878]">
          Pregled prisutnosti dolazi uskoro.
        </p>
      </div>
    </div>
  );
}
